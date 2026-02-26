import type * as Db from '../db'
import type * as Domain from '../domain/billing'
import type { Prisma } from '@prisma/client'
import { toNumberSafe } from '@/lib/decimal'

export function mapBillingMonthsDbToDomain(items: Array<Db.BillingMonth & { records: Array<{ amount: unknown; payments: Array<{ matchedAmount: unknown }> }> }>): Domain.BillingMonthSummary[] {
  return items.map((m) => {
    const totalBilled = m.records.reduce((s, r) => s + toNumberSafe(r.amount), 0)
    const totalReceived = m.records.reduce((s, r) => s + r.payments.reduce((x, p) => x + toNumberSafe(p.matchedAmount), 0), 0)
    return { id: m.id, year: m.year, month: m.month, closed: m.closed, totalBilled, totalReceived, outstanding: totalBilled - totalReceived }
  })
}

export function mapBillingRecordsApiToDomain(api: { items: Array<{ id: string; roomNumber: string; amount: number; note: string; dueDate: string | null; overdueDays: number; penalty: number; status: string }> }): Domain.BillingRecord[] {
  return api.items.map((it) => ({
    id: it.id,
    roomNumber: it.roomNumber,
    amount: it.amount,
    note: it.note || null,
    dueDate: it.dueDate ? new Date(it.dueDate) : null,
    overdueDays: it.overdueDays,
    penalty: it.penalty,
    status: it.status as Domain.BillingStatus
  }))
}

export type BillingRecordWithJoinsDb = Prisma.BillingRecordGetPayload<{ include: { room: { include: { floor: true } }, billingMonth: true } }>

export function mapRecordDbToPenaltyContext(r: BillingRecordWithJoinsDb): Domain.BillingRecordPenaltyContext {
  return {
    dueDate: r.dueDate,
    status: r.status as Domain.BillingStatus,
    room: { floorIdx: r.room.floor?.idx ?? 0, type: r.room.type as 'AIR' | 'NORMAL' },
    billingMonth: { year: r.billingMonth.year, month: r.billingMonth.month, dueDay: r.billingMonth.dueDay }
  }
}
