import { Prisma, DocumentStatus } from '@prisma/client'
import { createHash } from 'node:crypto'
import { NotFoundError, ConflictError } from '@/domain/errors'
import { renderDocx } from '@/lib/docx'
import { toNumberSafe } from '@/lib/decimal'
import { prisma } from '@/lib/db'
import type { AuthUser } from '@/lib/auth/types'
import { assertAuthenticated } from '@/lib/auth/guard'
import { requireRole } from '@/lib/auth/roles'
import { logAudit } from '@/services/audit'
import { hashBillingSnapshot } from '@/domain/document/integrity'

function getErrorCode(err: unknown): string | null {
  if (!err || typeof err !== 'object' || !('code' in err)) return null
  const code = (err as { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

export async function listDocuments(user: AuthUser | null, params: { year?: number; month?: number; roomNumber?: string }) {
  assertAuthenticated(user)
  requireRole(user.role, ['OWNER', 'ADMIN', 'STAFF'])
  let billingMonthId: string | undefined
  if (typeof params.year === 'number' && typeof params.month === 'number') {
    const bm = await prisma.billingMonth.findFirst({ where: { year: params.year, month: params.month } })
    billingMonthId = bm?.id
  }
  return prisma.documentVersion.findMany({
    where: {
      ...(billingMonthId ? { billingMonthId } : {}),
      ...(params.roomNumber ? { roomNumber: params.roomNumber } : {})
    },
    select: {
      id: true, versionNo: true, status: true, generatedAt: true,
      template: { select: { code: true, name: true } },
      roomNumber: true, billingMonthId: true
    },
    orderBy: [{ generatedAt: 'desc' }]
  })
}

export async function generateDocument(user: AuthUser | null, templateId: string, roomNumber: string, year: number, month: number, force: boolean | undefined, actorId: string) {
  assertAuthenticated(user)
  requireRole(user.role, ['OWNER', 'ADMIN'])
  const tpl = await prisma.documentTemplate.findFirst({ where: { id: templateId } })
  if (!tpl?.content) throw new NotFoundError('template not found')
  const room = await prisma.room.findFirst({ where: { number: roomNumber } })
  if (!room) throw new NotFoundError('room not found')
  const bm = await prisma.billingMonth.findFirst({ where: { year, month } }) ?? await prisma.billingMonth.create({ data: { year, month } })
  const record = await prisma.billingRecord.findFirst({
    where: { roomNumber, billingMonthId: bm.id },
    select: { amount: true, adjustments: true, raw: true }
  })
  const amount = record ? toNumberSafe(record.amount) : 0
  const adjustments = record ? toNumberSafe(record.adjustments) : 0
  const raw = (record?.raw ?? {}) as Record<string, unknown>
  const data: Record<string, unknown> = {
    ...raw,
    roomNumber,
    floor: room.floorId,
    year,
    month,
    amount,
    adjustments,
    total: amount + adjustments
  }
  const mappings = await prisma.billingFieldMapping.findMany({ where: { active: true } })
  for (const m of mappings) {
    const v = (raw as Record<string, unknown>)[m.sourceKey]
    if (v !== undefined) data[m.targetKey] = v
  }
  const sentExists = await prisma.documentVersion.findFirst({
    where: { templateId, roomNumber, billingMonthId: bm.id, status: DocumentStatus.SENT }
  })
  if (sentExists && !force) {
    throw new ConflictError('sent_exists_require_force')
  }

  let lastError: unknown = null
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const file = renderDocx(Buffer.from(tpl.content), data)
      const existingCount = await prisma.documentVersion.count({
        where: { templateId, roomNumber, billingMonthId: bm.id }
      })
      const activeVersion = await prisma.billingVersion.findFirst({
        where: { roomNumber, billingMonthId: bm.id, isActive: true },
        orderBy: { versionNo: 'desc' }
      })
      const totalAmount = activeVersion ? Number(activeVersion.totalAmount) : amount + adjustments
      const billingVersionId = activeVersion?.id ?? null
      const billingHash = activeVersion
        ? hashBillingSnapshot(activeVersion.snapshotData, Number(activeVersion.totalAmount))
        : hashBillingSnapshot(
            {
              roomNumber,
              billingMonthId: bm.id,
              rent: amount,
              water: 0,
              electric: 0,
              other: 0
            },
            totalAmount
          )
      const payloadForHash = JSON.stringify({
        roomNumber,
        billingMonthId: bm.id,
        billingVersionId,
        totalAmount,
        versionNo: existingCount + 1,
        templateId
      })
      const hash = createHash('sha256').update(payloadForHash).digest('hex')
      const version = await prisma.documentVersion.create({
        data: {
          templateId,
          roomId: room.id,
          roomNumber,
          billingMonthId: bm.id,
          billingVersionId,
          versionNo: existingCount + 1,
          status: DocumentStatus.DRAFT,
          file,
          hash,
          snapshotJson: {
            templateId,
            billingVersionId,
            billingHash
          }
        }
      })
      await prisma.auditLog.create({
        data: {
          action: 'DOCUMENT_GENERATE',
          entityType: 'DocumentVersion',
          entityId: version.id,
          data: JSON.stringify({ templateId, roomNumber, year, month, versionNo: version.versionNo, actorId })
        }
      })
      return { id: version.id, versionNo: version.versionNo }
    } catch (err) {
      const code = getErrorCode(err)
      if (code === 'P2034' || code === 'P2002') {
        lastError = err
        continue
      }
      throw err
    }
  }
  throw lastError instanceof Error ? lastError : new Error('transaction_conflict')

  return { id: '', versionNo: 0 }
}

export async function sendDocument(user: AuthUser | null, documentVersionId: string, actorId: string) {
  assertAuthenticated(user)
  requireRole(user.role, ['OWNER', 'ADMIN', 'STAFF'])
  const dv = await prisma.documentVersion.findFirst({ where: { id: documentVersionId } })
  if (!dv) throw new NotFoundError('not found')
  if (dv.status === DocumentStatus.SENT) throw new ConflictError('already_sent')
  const res = await prisma.documentVersion.updateMany({ where: { id: documentVersionId, status: { not: DocumentStatus.SENT } }, data: { status: DocumentStatus.SENT } })
  if (res.count === 0) throw new ConflictError('already_sent')
  await prisma.documentSendLog.create({
    data: { documentVersionId: documentVersionId, channel: 'MANUAL', delivered: true }
  })
  await prisma.auditLog.create({
    data: {
      action: 'DOCUMENT_SENT',
      entityType: 'DocumentVersion',
      entityId: documentVersionId,
      data: JSON.stringify({ actorId })
    }
  })
  return { id: documentVersionId } as const
}

export async function getDocumentFile(user: AuthUser | null, id: string) {
  assertAuthenticated(user)
  requireRole(user.role, ['OWNER', 'ADMIN', 'STAFF'])
  const version = await prisma.documentVersion.findFirst({ where: { id } })
  return version?.file ? Buffer.from(version.file) : null
}
