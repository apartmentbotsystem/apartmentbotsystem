import { Prisma } from '@prisma/client'
import { ConflictError, NotFoundError } from '@/domain/errors'
import { prisma } from '@/lib/db'
import type { AuthUser } from '@/lib/auth/types'
import { assertAuthenticated } from '@/lib/auth/guard'
import { requireRole } from '@/lib/auth/roles'
import { logAudit, logAuditTx } from '@/services/audit'
import { guardIdempotent } from '@/lib/system/idempotency'

export async function listPayments(user: AuthUser | null, year?: number, month?: number) {
  assertAuthenticated(user)
  requireRole(user.role, ['ADMIN', 'ACCOUNTANT'])
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
  requireRole(user.role, ['ADMIN', 'ACCOUNTANT'])
  const createData = { ...data, bankRef: data.bankRef ?? null }
  const p = await prisma.payment.create({ data: createData })
  await logAudit({ actorId, action: 'PAYMENT_CREATE', entity: 'Payment', entityId: p.id })
  return p
}

export async function importPayment(user: AuthUser | null, amount: number, occurredAt: Date, bankRef: string | null, actorId: string) {
  assertAuthenticated(user)
  requireRole(user.role, ['ADMIN', 'ACCOUNTANT'])
  guardIdempotent(`import:${amount}:${occurredAt.toISOString()}:${bankRef ?? ''}`)
  const p = await prisma.payment.create({ data: { amount, occurredAt, bankRef } })
  await logAudit({ actorId, action: 'PAYMENT_IMPORT', entity: 'Payment', entityId: 'bulk', metadata: { amount, occurredAt } })
  return p
}

export async function revertMatch(user: AuthUser | null, matchId: string, actorId: string) {
  assertAuthenticated(user)
  requireRole(user.role, ['ADMIN', 'ACCOUNTANT'])
  const existing = await prisma.paymentMatch.findFirst({ where: { id: matchId } })
  if (!existing) throw new NotFoundError('match not found')
  await prisma.paymentMatch.deleteMany({ where: { id: matchId } })
  const payment = await prisma.payment.findFirst({ where: { id: existing.paymentId } })
  if (!payment) throw new NotFoundError('payment not found')
  const sumRows = await prisma.paymentMatch.aggregate({
    where: { paymentId: existing.paymentId },
    _sum: { matchedAmount: true }
  })
  const sumDec = new Prisma.Decimal(sumRows._sum.matchedAmount ?? 0)
  const fullyMatched = sumDec.equals(new Prisma.Decimal(payment.amount))
  await prisma.payment.updateMany({ where: { id: existing.paymentId }, data: { matched: fullyMatched } })
  await logAuditTx(prisma, { actorId, action: 'PAYMENT_MATCH_REVERT', entity: 'PAYMENT_MATCH', entityId: matchId, metadata: { paymentId: existing.paymentId, billingRecordId: existing.billingRecordId } })
  return { ok: true } as const
}

export async function matchPayment(user: AuthUser | null, params: { paymentId: string; billingRecordId: string; amount: number; confirm?: boolean }, actorId: string) {
  assertAuthenticated(user)
  requireRole(user.role, ['ADMIN', 'ACCOUNTANT'])
  const { paymentId, billingRecordId, amount, confirm } = params
  const payment = await prisma.payment.findFirst({ where: { id: paymentId } })
  if (!payment) throw new NotFoundError('payment not found')
  const billing = await prisma.billingRecord.findFirst({ where: { id: billingRecordId } })
  if (!billing) throw new NotFoundError('billing record not found')
  const totalBillingDec = new Prisma.Decimal(billing.amount).plus(new Prisma.Decimal(billing.adjustments ?? 0))
  const existingBillingSumRows = await prisma.paymentMatch.aggregate({
    where: { billingRecordId },
    _sum: { matchedAmount: true }
  })
  const existingBillingSumDec = new Prisma.Decimal(existingBillingSumRows._sum.matchedAmount ?? 0)
  const existingPaymentSumRows = await prisma.paymentMatch.aggregate({
    where: { paymentId },
    _sum: { matchedAmount: true }
  })
  const existingPaymentSumDec = new Prisma.Decimal(existingPaymentSumRows._sum.matchedAmount ?? 0)
  if (existingBillingSumDec.plus(new Prisma.Decimal(amount)).gt(totalBillingDec)) {
    throw new ConflictError('overmatch billing')
  }
  if (existingPaymentSumDec.plus(new Prisma.Decimal(amount)).gt(new Prisma.Decimal(payment.amount))) {
    throw new ConflictError('overmatch payment')
  }
  const match = await prisma.paymentMatch.create({
    data: {
      paymentId,
      billingRecordId,
      matchedAmount: amount,
      confirmed: !!confirm,
      confirmedAt: confirm ? new Date() : null
    }
  })
  const newPaymentSumRows = await prisma.paymentMatch.aggregate({
    where: { paymentId },
    _sum: { matchedAmount: true }
  })
  const newPaymentSumDec = new Prisma.Decimal(newPaymentSumRows._sum.matchedAmount ?? 0)
  const fullyMatched = newPaymentSumDec.equals(new Prisma.Decimal(payment.amount))
  await prisma.payment.updateMany({ where: { id: paymentId }, data: { matched: fullyMatched } })
  await logAuditTx(prisma, { actorId, action: 'PAYMENT_MATCH', entity: 'PAYMENT_MATCH', entityId: match.id, metadata: { matchedAmount: amount, paymentId, billingRecordId } })
  return { id: match.id } as const
}
