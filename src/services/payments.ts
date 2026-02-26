import { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { ConflictError, NotFoundError } from '@/domain/errors'
import { prisma } from '@/lib/db'
import type { AuthUser } from '@/lib/auth/types'
import { assertAuthenticated } from '@/lib/auth/guard'
import { requireRole } from '@/lib/auth/roles'
import { logAudit, logAuditTx } from '@/services/audit'
import { guardIdempotent } from '@/lib/system/idempotency'

export async function listPayments(user: AuthUser | null, year?: number, month?: number) {
  assertAuthenticated(user)
  requireRole(user.role, ['OWNER', 'ADMIN'])
  let billingMonthId: string | undefined
  if (typeof year === 'number' && typeof month === 'number') {
    const bm = await prisma.billingMonth.findFirst({ where: { year, month } })
    billingMonthId = bm?.id
  }
  return prisma.payment.findMany({
    orderBy: { occurredAt: 'desc' },
    include: { matches: billingMonthId ? { where: { billingRecord: { billingMonthId } } } : true }
  })
}

export async function createPayment(user: AuthUser | null, data: { amount: number; occurredAt: Date; bankRef?: string | null }, actorId: string) {
  assertAuthenticated(user)
  requireRole(user.role, ['OWNER', 'ADMIN'])
  const createData = { ...data, bankRef: data.bankRef ?? null, paidAt: data.occurredAt }
  const p = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.payment.create({ data: createData })
    await logAuditTx(tx, { actorId, action: 'PAYMENT_CREATE', entity: 'Payment', entityId: created.id })
    return created
  })
  return p
}

export async function importPayment(user: AuthUser | null, amount: number, occurredAt: Date, bankRef: string | null, actorId: string) {
  assertAuthenticated(user)
  requireRole(user.role, ['OWNER', 'ADMIN'])
  guardIdempotent(`import:${amount}:${occurredAt.toISOString()}:${bankRef ?? ''}`)
  const p = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.payment.create({ data: { amount, occurredAt, paidAt: occurredAt, bankRef } })
    await logAuditTx(tx, { actorId, action: 'PAYMENT_IMPORT', entity: 'Payment', entityId: 'bulk', metadata: { amount, occurredAt } })
    return created
  })
  return p
}

export async function revertMatch(user: AuthUser | null, matchId: string, actorId: string) {
  assertAuthenticated(user)
  requireRole(user.role, ['OWNER', 'ADMIN'])
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.paymentMatch.findFirst({ where: { id: matchId } })
    if (!existing) throw new NotFoundError('match not found')
    await tx.paymentMatch.deleteMany({ where: { id: matchId } })
    const payment = await tx.payment.findFirst({ where: { id: existing.paymentId } })
    if (!payment) throw new NotFoundError('payment not found')
    const sumRows = await tx.paymentMatch.aggregate({
      where: { paymentId: existing.paymentId },
      _sum: { matchedAmount: true }
    })
    const sumDec = new Decimal(sumRows._sum.matchedAmount ?? 0)
    const fullyMatched = sumDec.equals(new Decimal(payment.amount))
    const remaining = await tx.paymentMatch.findMany({
      where: { paymentId: existing.paymentId, confirmed: true },
      include: { billingRecord: { include: { room: { select: { id: true } } } } },
      orderBy: { confirmedAt: 'desc' }
    })
    let roomId: string | null = null
    let matchedBillingVersionId: string | null = null
    if (remaining[0]) {
      roomId = remaining[0].billingRecord.room.id
      const activeVersion = await tx.billingVersion.findFirst({
        where: {
          roomNumber: remaining[0].billingRecord.roomNumber,
          billingMonthId: remaining[0].billingRecord.billingMonthId,
          isActive: true
        },
        select: { id: true }
      })
      matchedBillingVersionId = activeVersion?.id ?? null
    }
    await tx.payment.updateMany({
      where: { id: existing.paymentId },
      data: { matched: fullyMatched, roomId, matchedBillingVersionId }
    })
    await logAuditTx(tx, { actorId, action: 'PAYMENT_MATCH_REVERT', entity: 'PAYMENT_MATCH', entityId: matchId, metadata: { paymentId: existing.paymentId, billingRecordId: existing.billingRecordId } })
  })
  return { ok: true } as const
}

export async function matchPayment(user: AuthUser | null, params: { paymentId: string; billingRecordId: string; amount: number; confirm?: boolean }, actorId: string) {
  assertAuthenticated(user)
  requireRole(user.role, ['OWNER', 'ADMIN'])
  const { paymentId, billingRecordId, amount, confirm } = params
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const payment = await tx.payment.findFirst({ where: { id: paymentId } })
    if (!payment) throw new NotFoundError('payment not found')
    const billing = await tx.billingRecord.findFirst({
      where: { id: billingRecordId },
      include: { room: { select: { id: true } } }
    })
    if (!billing) throw new NotFoundError('billing record not found')
    const totalBillingDec = new Decimal(billing.amount)
    const existingBillingSumRows = await tx.paymentMatch.aggregate({
      where: { billingRecordId },
      _sum: { matchedAmount: true }
    })
    const existingBillingSumDec = new Decimal(existingBillingSumRows._sum.matchedAmount ?? 0)
    const existingPaymentSumRows = await tx.paymentMatch.aggregate({
      where: { paymentId },
      _sum: { matchedAmount: true }
    })
    const existingPaymentSumDec = new Decimal(existingPaymentSumRows._sum.matchedAmount ?? 0)
    if (existingBillingSumDec.plus(new Decimal(amount)).gt(totalBillingDec)) {
      throw new ConflictError('overmatch billing')
    }
    if (existingPaymentSumDec.plus(new Decimal(amount)).gt(new Decimal(payment.amount))) {
      throw new ConflictError('overmatch payment')
    }
    const activeVersion = await tx.billingVersion.findFirst({
      where: { roomNumber: billing.roomNumber, billingMonthId: billing.billingMonthId, isActive: true },
      select: { id: true }
    })
    const match = await tx.paymentMatch.create({
      data: {
        paymentId,
        billingRecordId,
        matchedAmount: amount,
        confirmed: !!confirm,
        confirmedAt: confirm ? new Date() : null
      }
    })
    const newPaymentSumRows = await tx.paymentMatch.aggregate({
      where: { paymentId },
      _sum: { matchedAmount: true }
    })
    const newPaymentSumDec = new Decimal(newPaymentSumRows._sum.matchedAmount ?? 0)
    const fullyMatched = newPaymentSumDec.equals(new Decimal(payment.amount))
    await tx.payment.updateMany({
      where: { id: paymentId },
      data: {
        matched: fullyMatched,
        paidAt: payment.occurredAt,
        roomId: billing.room.id,
        matchedBillingVersionId: activeVersion?.id ?? null
      }
    })
    await logAuditTx(tx, { actorId, action: 'PAYMENT_MATCH', entity: 'PAYMENT_MATCH', entityId: match.id, metadata: { matchedAmount: amount, paymentId, billingRecordId } })
    return { id: match.id } as const
  })
  return result
}
