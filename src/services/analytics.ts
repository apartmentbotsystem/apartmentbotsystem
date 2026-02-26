import { prisma } from '@/lib/db'
import type { AuthUser } from '@/lib/auth/types'
import { assertAuthenticated } from '@/lib/auth/guard'
import { requireRole } from '@/lib/auth/roles'
import { toNumberSafe } from '@/lib/decimal'

function getSpikeThresholds(): { waterSpikeRatio: number; electricSpikeRatio: number; totalSpikeRatio: number } {
  return { waterSpikeRatio: 3, electricSpikeRatio: 3, totalSpikeRatio: 2 }
}

function readSnapshotNumber(snapshot: unknown, key: string): number {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return 0
  const value = (snapshot as Record<string, unknown>)[key]
  return toNumberSafe(value)
}

export async function listAnomalies(year: number, month: number) {
  const bm = await prisma.billingMonth.findUnique({ where: { year_month: { year, month } }, select: { id: true } })
  if (!bm) return { items: [] as Array<{ room: string; waterRatio: number; electricRatio: number; totalRatio: number; zeroUsage: boolean }> }
  const prevYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : (month - 1)
  const prev = await prisma.billingMonth.findUnique({ where: { year_month: { year: prevYear, month: prevMonth } }, select: { id: true } })
  const curRecs = await prisma.billingRecord.findMany({ where: { billingMonthId: bm.id }, select: { roomNumber: true, water: true, electric: true, amount: true } })
  const prevMap = new Map<string, { water: number; electric: number; amount: number }>()
  if (prev) {
    const prevRecs = await prisma.billingRecord.findMany({ where: { billingMonthId: prev.id }, select: { roomNumber: true, water: true, electric: true, amount: true } })
    for (const r of prevRecs) prevMap.set(r.roomNumber, { water: Number(r.water), electric: Number(r.electric), amount: Number(r.amount) })
  }
  const { waterSpikeRatio, electricSpikeRatio, totalSpikeRatio } = getSpikeThresholds()
  const items: Array<{ room: string; waterRatio: number; electricRatio: number; totalRatio: number; zeroUsage: boolean }> = []
  for (const r of curRecs) {
    const prevVals = prevMap.get(r.roomNumber)
    if (!prevVals) continue
    const wr = prevVals.water > 0 ? Number(r.water) / prevVals.water : (Number(r.water) > 0 ? Infinity : 1)
    const er = prevVals.electric > 0 ? Number(r.electric) / prevVals.electric : (Number(r.electric) > 0 ? Infinity : 1)
    const tr = prevVals.amount > 0 ? Number(r.amount) / prevVals.amount : (Number(r.amount) > 0 ? Infinity : 1)
    const zero = (Number(r.water) === 0 && prevVals.water > 0) || (Number(r.electric) === 0 && prevVals.electric > 0)
    if (wr > waterSpikeRatio || er > electricSpikeRatio || tr > totalSpikeRatio || zero) {
      items.push({ room: r.roomNumber, waterRatio: wr, electricRatio: er, totalRatio: tr, zeroUsage: zero })
    }
  }
  items.sort((a, b) => b.totalRatio - a.totalRatio)
  return { items }
}

export async function getSummary(user: AuthUser | null) {
  assertAuthenticated(user)
  requireRole(user.role, ['OWNER', 'ADMIN'])
  const rooms = await prisma.room.count()
  const occupied = await prisma.room.count({ where: { status: 'OCCUPIED' } })
  const monthCandidates = await prisma.billingMonth.findMany({
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    take: 24,
    select: { id: true, year: true, month: true, _count: { select: { records: true } } }
  })
  const months = monthCandidates.length
    ? [monthCandidates.slice().sort((a, b) => {
        if ((b._count.records ?? 0) !== (a._count.records ?? 0)) return (b._count.records ?? 0) - (a._count.records ?? 0)
        if (b.year !== a.year) return b.year - a.year
        return b.month - a.month
      })[0]]
    : []
  let breakdown: { rent: number; water: number; electric: number; other: number; grand: number } | undefined
  let billing: { total: number; balance: number; breakdown?: { rent: number; water: number; electric: number; other: number; grand: number } } = { total: 0, balance: 0 }
  if (months[0]) {
    const versions = await prisma.billingVersion.findMany({
      where: { billingMonthId: months[0].id, isActive: true },
      select: { totalAmount: true, snapshotData: true }
    })
    let total = versions.reduce((s: number, v: { totalAmount: unknown }) => s + toNumberSafe(v.totalAmount), 0)
    let rent = versions.reduce((s: number, v: { snapshotData: unknown }) => s + readSnapshotNumber(v.snapshotData, 'rent'), 0)
    let water = versions.reduce((s: number, v: { snapshotData: unknown }) => s + readSnapshotNumber(v.snapshotData, 'water'), 0)
    let electric = versions.reduce((s: number, v: { snapshotData: unknown }) => s + readSnapshotNumber(v.snapshotData, 'electric'), 0)
    let other = versions.reduce((s: number, v: { snapshotData: unknown }) => s + readSnapshotNumber(v.snapshotData, 'other'), 0)
    let grand = versions.reduce((s: number, v: { totalAmount: unknown }) => s + toNumberSafe(v.totalAmount), 0)
    if (versions.length === 0) {
      const records = await prisma.billingRecord.findMany({
        where: { billingMonthId: months[0].id },
        select: { rent: true, water: true, electric: true, other: true, amount: true }
      })
      rent = records.reduce((s: number, r) => s + toNumberSafe(r.rent), 0)
      water = records.reduce((s: number, r) => s + toNumberSafe(r.water), 0)
      electric = records.reduce((s: number, r) => s + toNumberSafe(r.electric), 0)
      other = records.reduce((s: number, r) => s + toNumberSafe(r.other), 0)
      grand = records.reduce((s: number, r) => s + toNumberSafe(r.amount), 0)
      total = grand
    }
    breakdown = { rent, water, electric, other, grand }
    const matches = await prisma.paymentMatch.findMany({
      where: { confirmed: true, billingRecord: { billingMonthId: months[0].id } },
      select: { matchedAmount: true }
    })
    const paid = matches.reduce((s: number, m: { matchedAmount: unknown }) => s + toNumberSafe(m.matchedAmount), 0)
    billing = { total, balance: total - paid, breakdown }
  }
  const ticketsOpen = await prisma.ticket.count({ where: { status: 'OPEN' } })
  return { rooms, occupied, occupancyRate: rooms ? occupied / rooms : 0, billing, ticketsOpen }
}
