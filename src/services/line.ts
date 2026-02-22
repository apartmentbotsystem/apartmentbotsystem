import { prisma } from '@/lib/db'
import type { AuthUser } from '@/lib/auth/types'
import { assertAuthenticated } from '@/lib/auth/guard'
import { requireRole } from '@/lib/auth/roles'
import { logAudit } from '@/services/audit'

export async function createBinding(user: AuthUser | null, lineUserId: string, residentId: string) {
  assertAuthenticated(user)
  requireRole(user.role, ['ADMIN', 'STAFF'])
  const rr = await prisma.roomResident.findFirst({ where: { residentId, active: true } })
  if (!rr) {
    throw new Error('ACTIVE_RESIDENCY_NOT_FOUND')
  }
  const binding = await prisma.lineBinding.create({
    data: { lineUserId, roomNumber: rr.roomNumber }
  })
  await logAudit({ actorId: user.id, action: 'LINE_BIND_CREATE', entity: 'LineBinding', entityId: binding.id, metadata: { lineUserId, roomNumber: rr.roomNumber, residentId } })
  return binding
}

export async function approveBinding(user: AuthUser | null, lineUserId: string, actorId: string) {
  assertAuthenticated(user)
  requireRole(user.role, ['ADMIN', 'STAFF'])
  const binding = await prisma.lineBinding.findFirst({ where: { lineUserId } })
  if (!binding) {
    throw new Error('LINE_BINDING_NOT_FOUND')
  }
  await logAudit({ actorId, action: 'LINE_BIND_APPROVE', entity: 'LineBinding', entityId: binding.id, metadata: { lineUserId } })
  return binding
}
