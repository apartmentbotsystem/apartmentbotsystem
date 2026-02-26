import type { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { toNumberSafe } from '@/lib/decimal'
import { prisma } from '@/lib/db'
import type { AuthUser } from '@/lib/auth/types'
import { assertAuthenticated } from '@/lib/auth/guard'
import { requireRole } from '@/lib/auth/roles'

type VersionRow = { totalAmount: Decimal | number }

export async function listMonthsSummary(user: AuthUser | null) {
  assertAuthenticated(user)
  requireRole(user.role, ['OWNER', 'ADMIN', 'STAFF'])
  const months = await prisma.billingMonth.findMany({
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    include: {}
  })
  const monthIds = months.map(m => m.id)
  if (monthIds.length === 0) return []
  const versionRows = await prisma.billingVersion.findMany({
    where: { billingMonthId: { in: monthIds }, isActive: true },
    select: { billingMonthId: true, totalAmount: true }
  })
  const billedByMonth = new Map<string, number>()
  for (const v of versionRows) {
    const cur = billedByMonth.get(v.billingMonthId) ?? 0
    billedByMonth.set(v.billingMonthId, cur + toNumberSafe((v as unknown as { totalAmount: Decimal | number }).totalAmount))
  }
  const matchRows = await prisma.paymentMatch.findMany({
    where: { confirmed: true, billingRecord: { billingMonthId: { in: monthIds } } },
    select: { matchedAmount: true, billingRecord: { select: { billingMonthId: true } } }
  })
  const receivedByMonth = new Map<string, number>()
  for (const m of matchRows) {
    const bmId = (m as unknown as { billingRecord: { billingMonthId: string } }).billingRecord.billingMonthId
    const cur = receivedByMonth.get(bmId) ?? 0
    receivedByMonth.set(bmId, cur + toNumberSafe((m as unknown as { matchedAmount: Decimal | number }).matchedAmount))
  }
  return months.map(m => {
    const totalBilled = billedByMonth.get(m.id) ?? 0
    const totalReceived = receivedByMonth.get(m.id) ?? 0
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
}
