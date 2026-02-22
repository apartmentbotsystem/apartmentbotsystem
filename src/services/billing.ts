import { Prisma } from '@prisma/client'
import { ConflictError, NotFoundError } from '@/domain/errors'
import { prisma } from '@/lib/db'
import type { AuthUser } from '@/lib/auth/types'
import { assertAuthenticated } from '@/lib/auth/guard'
import { requireRole } from '@/lib/auth/roles'
import { logAuditTx } from '@/services/audit'
import { toNumberSafe } from '@/lib/decimal'

export async function ensureBillingMonth(year: number, month: number) {
  return prisma.billingMonth.upsert({
    where: { year_month: { year, month } },
    update: {},
    create: { year, month }
  })
}

export async function ensureFloor(idx: number, name?: string) {
  return prisma.floor.upsert({
    where: { idx },
    update: {},
    create: { idx, name: name ?? `ชั้น ${idx}` }
  })
}

export async function ensureRoom(number: string, floorId: string) {
  return prisma.room.upsert({
    where: { number },
    update: { floorId },
    create: { number, floorId }
  })
}

export async function listBillingRecords(user: AuthUser | null, year: number, month: number) {
  assertAuthenticated(user)
  requireRole(user.role, ['ADMIN', 'ACCOUNTANT'])
  const bm = await ensureBillingMonth(year, month)
  const records = await prisma.billingRecord.findMany({
    where: { billingMonthId: bm.id },
    include: { room: { include: { floor: true } }, billingMonth: true }
  })
  return records
}

export async function patchBillingRecords(user: AuthUser | null, year: number, month: number, rows: Array<{ id: string; amount: number; adjustments: number; note: string | null }>, actorId: string) {
  assertAuthenticated(user)
  requireRole(user.role, ['ADMIN', 'ACCOUNTANT'])
  const bm = await prisma.billingMonth.findFirst({ where: { year, month } })
  if (!bm) throw new NotFoundError('billing month not found')
  if (bm.closed) throw new ConflictError('billing month closed')
  for (const row of rows) {
    const base = await prisma.billingRecord.findFirst({ where: { id: row.id } })
    if (!base) continue
    let attemptErr: unknown = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const before = await prisma.billingRecord.findFirst({ where: { id: row.id } })
        if (!before) throw new NotFoundError('record not found')
        const hasMatchedPayment = await prisma.paymentMatch.findFirst({
          where: { billingRecordId: before.id, confirmed: true }
        })
        if (hasMatchedPayment) {
          throw new ConflictError('PAYMENT_LOCKED')
        }
        const latest = await prisma.billingVersion.findFirst({
          where: { roomNumber: before.roomNumber, billingMonthId: before.billingMonthId, isActive: true },
          orderBy: { versionNo: 'desc' }
        })
        if (!latest) {
          throw new ConflictError('missing active version for billing record')
        }
        await prisma.billingVersion.update({ where: { id: latest.id }, data: { isActive: false } })
        const updatedRes = await prisma.billingRecord.updateMany({
          where: { id: row.id, updatedAt: before.updatedAt },
          data: { amount: row.amount, adjustments: row.adjustments, note: row.note ?? null }
        })
        if (updatedRes.count === 0) {
          throw new ConflictError('record has been modified by another process')
        }
        const updated = await prisma.billingRecord.findFirst({ where: { id: row.id } })
        if (!updated) throw new NotFoundError('record not found after update')
        const totalAmount = toNumberSafe(updated.amount) + toNumberSafe(updated.adjustments) + toNumberSafe(updated.penalty ?? 0)
        await prisma.billingVersion.create({
          data: {
            roomNumber: updated.roomNumber,
            billingMonthId: updated.billingMonthId,
            versionNo: latest.versionNo + 1,
            snapshotData: {
              id: updated.id,
              roomNumber: updated.roomNumber,
              billingMonthId: updated.billingMonthId,
              amount: toNumberSafe(updated.amount),
              adjustments: toNumberSafe(updated.adjustments),
              note: updated.note ?? null,
              dueDate: updated.dueDate ? updated.dueDate.toISOString() : null,
              penalty: toNumberSafe(updated.penalty ?? 0),
              status: updated.status,
              updatedAt: updated.updatedAt.toISOString()
            },
            totalAmount,
            createdBy: actorId,
            isActive: true
          }
        })
        const activeCount = await prisma.billingVersion.count({
          where: { roomNumber: updated.roomNumber, billingMonthId: updated.billingMonthId, isActive: true }
        })
        if (activeCount !== 1) {
          throw new ConflictError('INTEGRITY_MULTIPLE_ACTIVE')
        }
        const payments = await prisma.paymentMatch.findMany({ where: { billingRecordId: updated.id, confirmed: true }, select: { matchedAmount: true } })
        const paymentTotalDec = payments.reduce((s: Prisma.Decimal, m: { matchedAmount: unknown }) => s.plus(new Prisma.Decimal(m.matchedAmount as any)), new Prisma.Decimal(0))
        const totalAmountDec = new Prisma.Decimal(updated.amount).plus(new Prisma.Decimal(updated.adjustments ?? 0)).plus(new Prisma.Decimal(updated.penalty ?? 0))
        const diffDec = paymentTotalDec.minus(totalAmountDec)
        if (!diffDec.isZero()) {
          await prisma.financialFlag.create({
            data: {
              roomNumber: updated.roomNumber,
              billingMonthId: updated.billingMonthId,
              type: diffDec.gt(0) ? 'OVERPAY_AFTER_BILLING_CHANGE' : 'UNDERPAY_AFTER_BILLING_CHANGE',
              difference: diffDec
            }
          })
        }
        await prisma.billingAuditLog.create({
          data: {
            billId: updated.id,
            action: 'UPDATE',
            beforeData: JSON.parse(JSON.stringify(before)),
            afterData: JSON.parse(JSON.stringify({ id: row.id, amount: row.amount, adjustments: row.adjustments, note: row.note }))
          }
        })
        await logAuditTx(prisma, { actorId, action: 'BILLING_EDIT', entity: 'BillingRecord', entityId: row.id, metadata: { before, after: row } })
        attemptErr = null
        break
      } catch (e: unknown) {
        if (typeof e === 'object' && e && 'code' in (e as any) && (e as any).code === 'P2034') {
          attemptErr = e
          continue
        }
        throw e
      }
    }
    if (attemptErr) throw attemptErr
  }
  return { ok: true } as const
}

export async function closeBillingMonth(user: AuthUser | null, year: number, month: number, actorId: string) {
  assertAuthenticated(user)
  requireRole(user.role, ['ADMIN', 'ACCOUNTANT'])
  const bm = await prisma.billingMonth.findFirst({ where: { year, month } })
  if (!bm) throw new NotFoundError('not found')
  if (bm.closed) return { ok: true, closed: true } as const
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.billingMonth.update({ where: { id: bm.id }, data: { closed: true } })
    await logAuditTx(tx, { actorId, action: 'BILLING_CLOSE', entity: 'BillingMonth', entityId: u.id, metadata: { year, month } })
    return u
  })
  const records = await prisma.billingRecord.findMany({ where: { billingMonthId: updated.id } })
  const versions = await prisma.billingVersion.findMany({ where: { billingMonthId: updated.id } })
  const matches = await prisma.paymentMatch.findMany({ where: { billingRecordId: { in: records.map(r => r.id) } } })
  const paymentsSummary = {
    totalMatched: matches.reduce((s, m) => s + toNumberSafe(m.matchedAmount), 0),
    totalRecords: records.length
  }
  const snapshot = {
    year,
    month,
    billingMonthId: updated.id,
    records: records.map(r => ({
      id: r.id,
      roomNumber: r.roomNumber,
      amount: toNumberSafe(r.amount),
      adjustments: toNumberSafe(r.adjustments),
      note: r.note ?? null,
      dueDate: r.dueDate ? r.dueDate.toISOString() : null,
      overdueDays: r.overdueDays,
      penalty: toNumberSafe(r.penalty ?? 0),
      status: r.status
    })),
    versions: versions.map(v => ({
      id: v.id,
      roomNumber: v.roomNumber,
      billingMonthId: v.billingMonthId,
      versionNo: v.versionNo,
      totalAmount: toNumberSafe(v.totalAmount),
      isActive: v.isActive,
      createdAt: v.createdAt.toISOString(),
      createdBy: v.createdBy
    })),
    paymentsSummary
  }
  const snapshotKey = `billing-month:${year}-${month}`
  await prisma.systemSnapshot.create({
    data: { snapshotKey, data: snapshot }
  })
  return { ok: true, id: updated.id } as const
}

export async function upsertBillingRecord(billingMonthId: string, roomNumber: string, amount: number, raw: Record<string, unknown>) {
  await prisma.billingRecord.upsert({
    where: { roomNumber_billingMonthId: { roomNumber, billingMonthId } },
    update: { amount, adjustments: 0, raw: JSON.parse(JSON.stringify(raw)) },
    create: { roomNumber, billingMonthId, amount, adjustments: 0, raw: JSON.parse(JSON.stringify(raw)) }
  })
}
