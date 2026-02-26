import { runPenaltyEngine } from '@/lib/runPenaltyEngine'
import { prisma } from '@/lib/db'
import type { AuthUser } from '@/lib/auth/types'
import { assertAuthenticated } from '@/lib/auth/guard'
import { requireRole } from '@/lib/auth/roles'
import { logAudit } from '@/services/audit'
import { enqueueDocumentSend } from '@/services/outbox'

export async function run(user: AuthUser | null) {
  assertAuthenticated(user)
  requireRole(user.role, ['OWNER', 'ADMIN'])
  return runPenaltyEngine(prisma)
}

export async function runWithAudit(user: AuthUser | null, actorId: string) {
  assertAuthenticated(user)
  requireRole(user.role, ['OWNER', 'ADMIN'])
  const result = await runPenaltyEngine(prisma)
  await logAudit({ actorId, action: 'MAINTENANCE_RUN', entity: 'PenaltyEngine', entityId: 'penalty-recalc', metadata: { updated: result.updated } })
  // Enqueue overdue reminders for rooms that are OVERDUE
  const overdue = await prisma.billingRecord.findMany({ where: { status: 'OVERDUE' }, select: { roomNumber: true, billingMonthId: true } })
  const versions = await prisma.documentVersion.findMany({
    where: { roomNumber: { in: overdue.map(o => o.roomNumber) }, billingMonthId: { in: overdue.map(o => o.billingMonthId!) } },
    select: { id: true, roomNumber: true, billingMonthId: true },
    orderBy: [{ versionNo: 'desc' }]
  })
  const latestByKey = new Map<string, { id: string; roomNumber: string; billingMonthId: string | null }>()
  for (const v of versions) {
    const k = `${v.roomNumber}:${v.billingMonthId ?? 'none'}`
    if (!latestByKey.has(k)) latestByKey.set(k, v)
  }
  for (const v of latestByKey.values()) {
    await enqueueDocumentSend({ documentVersionId: v.id, roomNumber: v.roomNumber, billingMonthId: v.billingMonthId })
  }
  return result
}
