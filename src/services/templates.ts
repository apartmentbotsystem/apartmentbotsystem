import { prisma } from '@/lib/db'
import type { AuthUser } from '@/lib/auth/types'
import { assertAuthenticated } from '@/lib/auth/guard'
import { requireRole } from '@/lib/auth/roles'
import { logAudit } from '@/services/audit'

export async function listTemplates(user: AuthUser | null) {
  assertAuthenticated(user)
  requireRole(user.role, ['ADMIN', 'MANAGER'])
  return prisma.documentTemplate.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, code: true, name: true, createdAt: true }
  })
}

export async function getTemplateMeta(user: AuthUser | null, id: string) {
  assertAuthenticated(user)
  requireRole(user.role, ['ADMIN', 'MANAGER'])
  return prisma.documentTemplate.findFirst({
    where: { id },
    select: { id: true, code: true, name: true, createdAt: true }
  })
}

export async function renameTemplate(user: AuthUser | null, id: string, name: string) {
  assertAuthenticated(user)
  requireRole(user.role, ['ADMIN', 'MANAGER'])
  await prisma.documentTemplate.updateMany({ where: { id }, data: { name } })
  await logAudit({ actorId: user.id, action: 'TEMPLATE_RENAME', entity: 'DocumentTemplate', entityId: id, metadata: { name } })
  return { id, name }
}

export async function uploadOrUpdateTemplate(user: AuthUser | null, code: string, name: string, content: Buffer, actorId: string) {
  assertAuthenticated(user)
  requireRole(user.role, ['ADMIN', 'MANAGER'])
  const template = await prisma.documentTemplate.upsert({
    where: { code },
    update: { name, content },
    create: { code, name, content }
  })
  await logAudit({ actorId, action: 'TEMPLATE_UPLOAD', entity: 'DocumentTemplate', entityId: template.id, metadata: { code } })
  return { id: template.id, code: template.code, name: template.name }
}

export async function replaceTemplate(user: AuthUser | null, id: string, content: Buffer, actorId: string) {
  assertAuthenticated(user)
  requireRole(user.role, ['ADMIN', 'MANAGER'])
  await prisma.documentTemplate.updateMany({
    where: { id },
    data: { content }
  })
  await logAudit({ actorId, action: 'TEMPLATE_REPLACE', entity: 'DocumentTemplate', entityId: id })
  return { id }
}
