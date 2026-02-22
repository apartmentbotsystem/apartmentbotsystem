import { runPenaltyEngine } from '@/lib/runPenaltyEngine'
import { prisma } from '@/lib/db'
import type { AuthUser } from '@/lib/auth/types'
import { assertAuthenticated } from '@/lib/auth/guard'
import { requireRole } from '@/lib/auth/roles'
import { logAudit } from '@/services/audit'

export async function run(user: AuthUser | null) {
  assertAuthenticated(user)
  requireRole(user.role, ['ADMIN'])
  return runPenaltyEngine(prisma)
}

export async function runWithAudit(user: AuthUser | null, actorId: string) {
  assertAuthenticated(user)
  requireRole(user.role, ['ADMIN'])
  const result = await runPenaltyEngine(prisma)
  await logAudit({ actorId, action: 'MAINTENANCE_RUN', entity: 'PenaltyEngine', entityId: 'penalty-recalc', metadata: { updated: result.updated } })
  return result
}
