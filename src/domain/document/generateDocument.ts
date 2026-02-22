import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { getActiveTemplate } from '../template/service'
import { validateTemplateContent } from '../template/placeholderRegistry'
import { DomainError } from '@/domain/errors'

type GenerateInput = {
  roomNumber: string
  billingMonthId: string
  templateGroupId: string
  actorId: string
}

function toNumber(d: unknown): number {
  if (typeof d === 'number') return d
  if (typeof d === 'bigint') return Number(d)
  if (typeof d === 'string') return Number(d)
  if (d && typeof d === 'object' && 'toNumber' in (d as any)) return Number((d as any).toNumber())
  return 0
}

export async function generateDocumentOne(input: GenerateInput) {
  const { roomNumber, billingMonthId, templateGroupId, actorId } = input
  const active = await getActiveTemplate(templateGroupId)
  // Validate placeholders against template type
  validateTemplateContent(active.group.type, active.contentJson)

  const record = await prisma.billingRecord.findFirst({ where: { roomNumber, billingMonthId } })
  if (!record) throw new DomainError('NOT_FOUND', 'Billing record not found', 404)
  const activeVersion = await prisma.billingVersion.findFirst({
    where: { roomNumber, billingMonthId, isActive: true }
  })
  if (!activeVersion) throw new DomainError('NO_ACTIVE_VERSION', 'Billing version missing', 422)

  const total = toNumber(activeVersion.totalAmount)
  const isZeroAmount = total <= 0

  const snapshotJson = {
    templateGroupId,
    templateVersion: active.version,
    roomNumber,
    billingMonthId,
    billingSnapshot: activeVersion.snapshotData,
    totals: { total }
  }

  // Unique guard: room+month+templateGroup
  const existing = await prisma.documentVersion.findFirst({
    where: { roomNumber, billingMonthId, templateGroupId }
  })
  if (existing) {
    throw new DomainError('DUPLICATE_DOCUMENT', 'Document for room+month+template exists', 409)
  }

  const created = await prisma.documentVersion.create({
    data: {
      templateId: active.id, // link to template record for traceability
      roomNumber,
      billingMonthId,
      versionNo: 1,
      status: 'DRAFT',
      file: Buffer.from([]), // generation of binary is out of scope here
      hash: '',
      templateGroupId,
      templateVersion: active.version,
      snapshotJson,
      isZeroAmount
    }
  })

  await prisma.auditLog.create({
    data: {
      action: 'DOCUMENT_GENERATE',
      entityType: 'DocumentVersion',
      entityId: created.id,
      data: { roomNumber, billingMonthId, templateGroupId, templateVersion: active.version, isZeroAmount },
      billingRecordId: record.id
    }
  })

  return { id: created.id, roomNumber, billingMonthId, isZeroAmount }
}

export async function generateDocumentsBatch(inputs: GenerateInput[]) {
  const results: { input: GenerateInput; ok: boolean; error?: string; id?: string }[] = []
  for (const input of inputs) {
    try {
      const res = await generateDocumentOne(input)
      results.push({ input, ok: true, id: res.id })
    } catch (e: any) {
      results.push({ input, ok: false, error: e?.message ?? 'unknown' })
    }
  }
  return results
}
