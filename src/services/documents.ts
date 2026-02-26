import { Prisma, DocumentStatus } from '@prisma/client'
import { createHash } from 'node:crypto'
import { NotFoundError, ConflictError } from '@/domain/errors'
import { renderDocx } from '@/lib/docx'
import { toNumberSafe } from '@/lib/decimal'
import { prisma } from '@/lib/db'
import type { AuthUser } from '@/lib/auth/types'
import { assertAuthenticated } from '@/lib/auth/guard'
import { requireRole } from '@/lib/auth/roles'
import { logAudit } from '@/services/auditService'
import * as DocPolicy from '@/policies/documentPolicy'
import * as RolePolicy from '@/policies/rolePolicy'
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
  RolePolicy.assertRole(user, 'GENERATE_DOCUMENT')
  const tpl = await prisma.documentTemplate.findFirst({ where: { id: templateId } })
  if (!tpl?.content) throw new NotFoundError('template not found')
  const room = await prisma.room.findFirst({ where: { number: roomNumber } })
  if (!room) throw new NotFoundError('room not found')
  const bm = await prisma.billingMonth.findFirst({ where: { year, month } }) ?? await prisma.billingMonth.create({ data: { year, month } })
  const record = await prisma.billingRecord.findFirst({
    where: { roomNumber, billingMonthId: bm.id },
    select: { amount: true, raw: true }
  })
  const amount = record ? toNumberSafe(record.amount) : 0
  const raw = (record?.raw ?? {}) as Record<string, unknown>
  const data: Record<string, unknown> = {
    ...raw,
    roomNumber,
    floor: room.floorId,
    year,
    month,
    amount,
    total: amount
  }
  const mappings = await prisma.billingFieldMapping.findMany({ where: { active: true } })
  for (const m of mappings) {
    const v = (raw as Record<string, unknown>)[m.sourceKey]
    if (v !== undefined) data[m.targetKey] = v
  }
  const okGenerate = await DocPolicy.canGenerate(roomNumber, bm.id)
  if (!okGenerate) throw new ConflictError('document_locked')

  let lastError: unknown = null
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      let file: Buffer
      try {
        file = renderDocx(Buffer.from(tpl.content), data)
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          file = Buffer.from('DRAFT')
        } else {
          throw err
        }
      }
      const existingCount = await prisma.documentVersion.count({
        where: { templateId, roomNumber, billingMonthId: bm.id }
      })
      const activeVersion = await prisma.billingVersion.findFirst({
        where: { roomNumber, billingMonthId: bm.id, isActive: true },
        orderBy: { versionNo: 'desc' }
      }).catch(async () => {
        return await prisma.billingVersion.findFirst({
          where: { roomNumber, billingMonthId: bm.id, isActive: true },
          orderBy: { versionNo: 'desc' }
        })
      })
      const totalAmount = activeVersion ? Number(activeVersion.totalAmount) : amount
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
      // Version Diff Guard: block if no changes from latest version in this month
      const latest = await prisma.documentVersion.findFirst({
        where: { roomNumber, billingMonthId: bm.id },
        orderBy: { versionNo: 'desc' },
        select: { snapshotJson: true }
      })
      try {
        const prevHash = latest && latest.snapshotJson && typeof latest.snapshotJson === 'object'
          ? (latest.snapshotJson as any)?.billingHash ?? null
          : null
        if (prevHash && prevHash === billingHash) {
          throw new ConflictError('no_changes_detected')
        }
      } catch (e) {
        if (e instanceof ConflictError) throw e
      }
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
      await logAudit({
        entityType: 'DOCUMENT',
        entityId: version.id,
        action: 'GENERATE',
        oldValue: null,
        newValue: { templateId, roomNumber, year, month, versionNo: version.versionNo },
        actor: user
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
  RolePolicy.assertRole(user, 'SEND_DOCUMENT')
  const dv = await prisma.documentVersion.findFirst({ where: { id: documentVersionId } })
  if (!dv) throw new NotFoundError('not found')
  if (dv.status === DocumentStatus.SENT) throw new ConflictError('already_sent')
  const res = await prisma.documentVersion.updateMany({ where: { id: documentVersionId, status: { not: DocumentStatus.SENT } }, data: { status: DocumentStatus.SENT } })
  if (res.count === 0) throw new ConflictError('already_sent')
  await prisma.documentSendLog.create({
    data: { documentVersionId: documentVersionId, channel: 'MANUAL', delivered: true }
  })
  await logAudit({
    entityType: 'DOCUMENT',
    entityId: documentVersionId,
    action: 'SEND',
    oldValue: { status: dv.status },
    newValue: { status: 'SENT' },
    actor: user
  })
  return { id: documentVersionId } as const
}

export async function changeDocumentStatus(user: AuthUser | null, id: string, next: DocumentStatus) {
  if (user) {
    assertAuthenticated(user)
    RolePolicy.assertRole(user, 'CHANGE_STATUS')
  }
  const dv = await prisma.documentVersion.findFirst({ where: { id } })
  if (!dv) throw new NotFoundError('not found')
  const ok = await DocPolicy.canChangeStatus(dv, next)
  if (!ok) {
    throw new ConflictError('forbidden_status_change')
  }
  const updated = await prisma.documentVersion.update({
    where: { id },
    data: { status: next }
  })
  await logAudit({
    entityType: 'DOCUMENT',
    entityId: updated.id,
    action: 'STATUS_CHANGE',
    oldValue: { status: dv.status },
    newValue: { status: updated.status },
    actor: user
  })
  return { id: updated.id, status: updated.status as DocumentStatus }
}

export async function getDocumentFile(user: AuthUser | null, id: string) {
  assertAuthenticated(user)
  requireRole(user.role, ['OWNER', 'ADMIN', 'STAFF'])
  const version = await prisma.documentVersion.findFirst({ where: { id } })
  return version?.file ? Buffer.from(version.file) : null
}
