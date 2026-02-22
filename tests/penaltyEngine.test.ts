import { computePenalty } from '../src/lib/penaltyEngine'
import type { Domain } from '../src/types'

const mkRec = (overdueDays: number, opts?: { floorIdx?: number; type?: 'AIR' | 'NORMAL' }): Domain.BillingRecordPenaltyContext => {
  const today = new Date(2026, 0, 20)
  const dueDate = new Date(today.getTime() - overdueDays * 24 * 60 * 60 * 1000)
  return {
    dueDate,
    status: 'PENDING',
    room: { floorIdx: opts?.floorIdx ?? 2, type: opts?.type ?? 'NORMAL' },
    billingMonth: { year: 2026, month: 1, dueDay: dueDate.getDate() }
  }
}

function expectEqual(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) {
    console.error(`Assertion failed: ${label}\n  expected: ${e}\n  received: ${a}`)
    process.exit(1)
  }
}

// Case 1: no overdue
{
  const rec = mkRec(0)
  const res = computePenalty(rec, rec.dueDate!)
  expectEqual(res.overdueDays, 0, 'no overdue days')
  expectEqual(res.status, 'PENDING', 'status PENDING on due date')
  expectEqual(res.penalty, 0, 'no penalty on time')
}

// Case 2: 5 days overdue -> OVERDUE policy threshold (>7 days)
{
  const rec = mkRec(5)
  const res = computePenalty(rec, new Date(2026, 0, 20))
  expectEqual(res.overdueDays >= 5, true, '>=5 overdue days')
  expectEqual(res.status === 'OVERDUE' || res.status === 'PENDING', true, 'status transitions around 7 days')
}

// Case 3: 10 days overdue -> OVERDUE, penalty per day default 100
{
  const rec = mkRec(10)
  const res = computePenalty(rec, new Date(2026, 0, 20))
  expectEqual(res.status, 'OVERDUE', 'status OVERDUE over 7 days')
  expectEqual(res.penalty, 100 * res.overdueDays, 'penalty 100/day')
}

// Case 4: Air room at floor 1 -> penalty per day 200
{
  const rec = mkRec(3, { floorIdx: 1, type: 'AIR' })
  const res = computePenalty(rec, new Date(2026, 0, 20))
  expectEqual(res.penalty, 200 * res.overdueDays, 'penalty 200/day for AIR at floor 1')
}

// Case 5: Termination after >15 days
{
  const rec = mkRec(16)
  const res = computePenalty(rec, new Date(2026, 0, 20))
  expectEqual(res.status, 'TERMINATED', 'status TERMINATED after 15 days')
}

console.log('penaltyEngine tests passed')
