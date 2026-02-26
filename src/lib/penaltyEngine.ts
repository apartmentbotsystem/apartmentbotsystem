import type { Domain } from '@/types'

export type BillingRecordPenaltyContext = {
  dueDate: Date | null
  status: Domain.BillingStatus
  room: { floorIdx: number; type: 'AIR' | 'NORMAL' }
  billingMonth: { year: number; month: number; dueDay: number }
}

export function computePenalty(rec: BillingRecordPenaltyContext, today = new Date()) {
  const dueDay = rec.billingMonth.dueDay ?? 7
  const dueDate = rec.dueDate ?? new Date(rec.billingMonth.year, rec.billingMonth.month - 1, dueDay)
  const ms = today.getTime() - dueDate.getTime()
  const overdueDays = ms > 0 ? Math.floor(ms / (24 * 60 * 60 * 1000)) : 0
  let status: Domain.BillingStatus = rec.status
  let penaltyPerDay = 100
  const floorIdx = rec.room.floorIdx ?? 0
  const isAir = rec.room.type === 'AIR'
  if (floorIdx === 1 && isAir) penaltyPerDay = 200
  const penalty = overdueDays > 0 ? penaltyPerDay * overdueDays : 0
  if (overdueDays > 15) status = 'TERMINATED'
  else if (overdueDays > 7) status = 'OVERDUE'
  else status = 'PENDING'
  return { dueDate, overdueDays, penalty, status }
}
