import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export interface AuditLogInput {
  actorId: string
  action: string
  entity: string
  entityId?: string
  metadata?: Record<string, unknown>
}

export async function logAudit(input: AuditLogInput) {
  const { actorId, action, entity, entityId, metadata } = input
  await prisma.auditLog.create({
    data: {
      action: action.toUpperCase(),
      entityType: entity,
      entityId: entityId ?? '',
      data: metadata ? JSON.stringify({ actorId, ...metadata }) : JSON.stringify({ actorId })
    }
  })
}

export async function logAuditTx(tx: Prisma.TransactionClient, input: AuditLogInput) {
  const { actorId, action, entity, entityId, metadata } = input
  await tx.auditLog.create({
    data: {
      action: action.toUpperCase(),
      entityType: entity,
      entityId: entityId ?? '',
      data: metadata ? JSON.stringify({ actorId, ...metadata }) : JSON.stringify({ actorId })
    }
  })
}
