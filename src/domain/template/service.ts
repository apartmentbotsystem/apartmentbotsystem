import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { DomainError } from '@/domain/errors'

export async function createDraft(groupId: string) {
  const latest = await prisma.template.findFirst({
    where: { groupId },
    orderBy: { version: 'desc' }
  })
  const version = latest ? latest.version + 1 : 1
  const t = await prisma.template.create({
    data: {
      groupId,
      version,
      isDraft: true,
      isPublished: false,
      contentJson: {}
    }
  })
  return t
}

export async function publishTemplate(templateId: string) {
  const tmpl = await prisma.template.findUnique({ where: { id: templateId } })
  if (!tmpl) throw new DomainError('NOT_FOUND', 'Template not found', 404)
  await prisma.template.updateMany({
    where: { groupId: tmpl.groupId, isPublished: true },
    data: { isPublished: false }
  })
  const updated = await prisma.template.update({
    where: { id: tmpl.id },
    data: { isDraft: false, isPublished: true }
  })
  return updated
}

export async function getActiveTemplate(groupId: string) {
  const active = await prisma.template.findFirst({
    where: { groupId, isPublished: true },
    orderBy: { version: 'desc' },
    include: { group: true }
  })
  if (!active) throw new DomainError('NO_ACTIVE_TEMPLATE', 'No published template for group', 422)
  return active
}
