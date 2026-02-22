import { prisma } from '@/lib/db'
import { Prisma, DocumentStatus } from '@prisma/client'
import { DomainError } from '@/domain/errors'
import crypto from 'node:crypto'

type Input = {
  roomId: string
  billingMonth: string
  templateGroupId: string
  confirmRegenerate?: boolean
  actorId: string
}

type Output = {
  id: string
  version: number
  isZeroAmount: boolean
  billingChanged: boolean
}

function stableStringify(obj: unknown): string {
  const seen = new WeakSet()
  const helper = (x: unknown): unknown => {
    if (x === null || typeof x !== 'object') return x
    if (seen.has(x as object)) return '[Circular]'
    seen.add(x as object)
    if (Array.isArray(x)) return (x as unknown[]).map(helper)
    const o = x as Record<string, unknown>
    const keys = Object.keys(o).sort()
    const out: Record<string, unknown> = {}
    for (const k of keys) out[k] = helper(o[k])
    return out
  }
  return JSON.stringify(helper(obj))
}

function hashObject(obj: unknown): string {
  const s = stableStringify(obj)
  return crypto.createHash('sha256').update(s).digest('hex')
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'bigint') return Number(v)
  if (typeof v === 'string') return Number(v)
  if (v && typeof v === 'object' && 'toNumber' in (v as unknown as Record<string, unknown>)) {
    const fn = (v as unknown as Record<string, () => number>)['toNumber']
    try { return typeof fn === 'function' ? Number(fn.call(v)) : 0 } catch { return 0 }
  }
  return 0
}

export async function generateDocumentVersion(input: Input): Promise<Output> {
  const { roomId, billingMonth, templateGroupId, confirmRegenerate, actorId } = input
  // ensure a hosting DocumentTemplate exists globally (outside tx to avoid FK visibility issues)
  const hostTpl = await prisma.documentTemplate.upsert({
    where: { code: `TE:${templateGroupId}` },
    update: {},
    create: { code: `TE:${templateGroupId}`, name: `TE Host ${templateGroupId}`, content: Buffer.from([]) }
  })
  const activeTemplate = await prisma.template.findFirst({
    where: { groupId: templateGroupId, isPublished: true },
    orderBy: { version: 'desc' },
    include: { group: true }
  })
  if (!activeTemplate) {
    throw new DomainError('NO_ACTIVE_TEMPLATE', 'No published template in group', 422)
  }
  // fetch the host template again for FK ref
  const docTpl = await prisma.documentTemplate.findUnique({ where: { code: `TE:${templateGroupId}` } })
  if (!docTpl) throw new DomainError('HOST_TEMPLATE_MISSING', 'Host template missing', 500)
  const billingVersion = await prisma.billingVersion.findFirst({
    where: { roomNumber: roomId, billingMonthId: billingMonth, isActive: true }
  })
  if (!billingVersion) {
    throw new DomainError('NO_ACTIVE_VERSION', 'Billing version missing', 422)
  }
  const total = toNumber(billingVersion.totalAmount)
  const isZeroAmount = total === 0

  const chainCandidates = await prisma.documentVersion.findMany({
    where: { roomNumber: roomId, billingMonthId: billingMonth },
    orderBy: { versionNo: 'desc' }
  })
  const inChain = chainCandidates.filter(dv => {
    if (dv.templateGroupId && dv.templateGroupId === templateGroupId) return true
    const sj = dv.snapshotJson as unknown
    if (sj && typeof sj === 'object' && (sj as Record<string, unknown>)['templateGroupId'] === templateGroupId) return true
    return false
  })
  const latest = inChain[0]
  if (latest && latest.status === DocumentStatus.SENT && confirmRegenerate !== true) {
    throw new DomainError('REGENERATE_CONFIRM_REQUIRED', 'Cannot regenerate sent document without confirmation', 409)
  }
  const latestHash: string | null = latest && latest.snapshotJson && typeof latest.snapshotJson === 'object'
    ? (latest.snapshotJson as Record<string, unknown>)['billingHash'] as string ?? null
    : null

  const currentBillingSnapshot = {
    snapshotData: billingVersion.snapshotData,
    totalAmount: Number(billingVersion.totalAmount)
  }
  const currentHash = hashObject(currentBillingSnapshot)
  const billingChanged = latestHash ? latestHash !== currentHash : false

  const version = latest ? latest.versionNo + 1 : 1

  const created = await prisma.documentVersion.create({
    data: {
      templateId: docTpl.id,
      roomNumber: roomId,
      billingMonthId: billingMonth,
      versionNo: version,
      status: DocumentStatus.READY,
      file: Buffer.from([]),
      hash: '',
      // keep column templateGroupId null to avoid uniqueness collisions; store in snapshot
      templateGroupId: null,
      templateVersion: activeTemplate.version,
      snapshotJson: {
        templateGroupId,
        templateVersion: activeTemplate.version,
        billingHash: currentHash,
        billingChanged
      },
      isZeroAmount
    }
  })

  if (isZeroAmount) {
    await prisma.auditLog.create({
      data: {
        action: 'ZERO_AMOUNT_GENERATED',
        entityType: 'DocumentVersion',
        entityId: created.id,
        data: { roomNumber: roomId, billingMonthId: billingMonth, templateGroupId },
        billingRecordId: null
      }
    })
  }
  await prisma.auditLog.create({
    data: {
      action: 'DOCUMENT_GENERATE_V2',
      entityType: 'DocumentVersion',
      entityId: created.id,
      data: {
        templateGroupId,
        templateVersion: activeTemplate.version,
        billingChanged,
        actorId
      },
      billingRecordId: null
    }
  })
  return { id: created.id, version, isZeroAmount, billingChanged }
}

export async function generateDocumentVersionBatch(requests: Array<Omit<Input, 'actorId'> & { actorId: string }>) {
  const results: Array<{ ok: true; value: Output } | { ok: false; error: string; input: Omit<Input, 'actorId'> & { actorId: string } }> = []
  for (const r of requests) {
    try {
      const out = await generateDocumentVersion(r)
      results.push({ ok: true, value: out })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown'
      results.push({ ok: false, error: msg, input: r })
    }
  }
  return results
}
