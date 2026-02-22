import type { Prisma } from '@prisma/client'
import { toNumberSafe } from '@/lib/decimal'
import { prisma } from '@/lib/db'
import type { AuthUser } from '@/lib/auth/types'
import { assertAuthenticated } from '@/lib/auth/guard'
import { requireRole } from '@/lib/auth/roles'

type VersionRow = { totalAmount: Prisma.Decimal | number }

export async function listMonthsSummary(user: AuthUser | null) {
  assertAuthenticated(user)
  requireRole(user.role, ['ADMIN', 'ACCOUNTANT', 'MANAGER'])
  const months = await prisma.billingMonth.findMany({
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    include: {}
  })
  const data = await Promise.all(
    months.map(async (m: { id: string; year: number; month: number; closed: boolean }) => {
      const versions = await prisma.billingVersion.findMany({
        where: { billingMonthId: m.id, isActive: true },
        select: { totalAmount: true }
      })
      const totalBilled = versions.reduce((sum: number, r: VersionRow) => sum + toNumberSafe(r.totalAmount), 0)
      const matches = await prisma.paymentMatch.findMany({
        where: { confirmed: true, billingRecord: { billingMonthId: m.id } },
        select: { matchedAmount: true }
      })
      const totalReceived = matches.reduce((sum: number, p: { matchedAmount: Prisma.Decimal | number }) => sum + toNumberSafe(p.matchedAmount), 0)
      return {
        id: m.id,
        year: m.year,
        month: m.month,
        closed: m.closed,
        totalBilled,
        totalReceived,
        outstanding: totalBilled - totalReceived
      }
    })
  )
  return data
}
