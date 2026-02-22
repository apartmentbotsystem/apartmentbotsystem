import type { Prisma, PaymentMatch } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { AuthUser } from '@/lib/auth/types'
import { assertAuthenticated } from '@/lib/auth/guard'
import { requireRole } from '@/lib/auth/roles'
import { toNumberSafe } from '@/lib/decimal'

export async function getSummary(user: AuthUser | null) {
  assertAuthenticated(user)
  requireRole(user.role, ['ADMIN', 'MANAGER'])
  const rooms = await prisma.room.count()
  const occupied = await prisma.room.count({ where: { status: 'OCCUPIED' } })
  const months = await prisma.billingMonth.findMany({ orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 1 })
  let billing = { total: 0, balance: 0 }
  if (months[0]) {
    const versions = await prisma.billingVersion.findMany({
      where: { billingMonthId: months[0].id, isActive: true },
      select: { totalAmount: true }
    })
    const total = versions.reduce((s: number, v: { totalAmount: unknown }) => s + toNumberSafe(v.totalAmount), 0)
    const matches = await prisma.paymentMatch.findMany({
      where: { confirmed: true, billingRecord: { billingMonthId: months[0].id } },
      select: { matchedAmount: true }
    })
    const paid = matches.reduce((s: number, m: { matchedAmount: unknown }) => s + toNumberSafe(m.matchedAmount), 0)
    billing = { total, balance: total - paid }
  }
  const ticketsOpen = await prisma.ticket.count({ where: { status: 'OPEN' } })
  return { rooms, occupied, occupancyRate: rooms ? occupied / rooms : 0, billing, ticketsOpen }
}
