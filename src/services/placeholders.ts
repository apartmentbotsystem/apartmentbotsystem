import { prisma } from '@/lib/db'
import type { AuthUser } from '@/lib/auth/types'
import { assertAuthenticated } from '@/lib/auth/guard'
import { requireRole } from '@/lib/auth/roles'

export async function listPlaceholders(user: AuthUser | null, year: number, month: number, roomNumber?: string) {
  assertAuthenticated(user)
  requireRole(user.role, ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'STAFF'])
  const bm = await prisma.billingMonth.findFirst({ where: { year, month } })
  if (!bm) return []
  const records = await prisma.billingRecord.findMany({
    where: { billingMonthId: bm.id, ...(roomNumber ? { roomNumber } : {}) },
    select: { raw: true }
  })
  const keys = new Map<string, unknown>()
  for (const r of records) {
    const obj = (r.raw ?? {}) as Record<string, unknown>
    for (const [k, v] of Object.entries(obj)) {
      if (!keys.has(k)) keys.set(k, v)
    }
  }
  const items = [...keys.entries()].map(([key, sample]) => ({
    key,
    normalizedKey: key.trim().replace(/\s+/g, '_'),
    sample
  }))
  items.sort((a, b) => a.key.localeCompare(b.key, 'th'))
  return items
}
