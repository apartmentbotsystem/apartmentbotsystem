import { prisma } from '@/lib/db'
import { DomainError } from '@/domain/errors'
import { logInfo } from '@/infrastructure/logger'
import { enqueueDocumentSend } from '@/services/outbox'
import * as DocPolicy from '@/policies/documentPolicy'
import { logAudit } from '@/services/auditService'
import type { DocumentVersion } from '@prisma/client'

type SendInput = { documentVersionId: string; actorId?: string; forceResend?: boolean }
type SendResult = { status: 'SUCCESS' | 'FAILED' | 'QUEUED'; lineMessageId?: string; reason?: 'THROTTLED' }

export async function sendDocumentVersion(input: SendInput): Promise<SendResult> {
  const { documentVersionId, forceResend } = input
  const dv = await prisma.documentVersion.findUnique({ where: { id: documentVersionId } })
  if (!dv) throw new DomainError('NOT_FOUND', 'document version not found', 404)
  const ok = await DocPolicy.canSend({ status: dv.status } as Pick<DocumentVersion, 'status'>)
  if (!ok && forceResend !== true) {
    throw new DomainError('ALREADY_SENT', 'already sent; force required to resend', 409)
  }
  const q = await enqueueDocumentSend({ documentVersionId, roomNumber: dv.roomNumber, billingMonthId: dv.billingMonthId ?? null })
  logInfo('delivery.enqueued', { documentVersionId, roomNumber: dv.roomNumber, billingMonthId: dv.billingMonthId ?? null })
  await logAudit({ entityType: 'DOCUMENT', entityId: documentVersionId, action: 'ENQUEUE_SEND', oldValue: { status: dv.status }, newValue: { queued: true }, actor: null })
  return { status: q.status }
}

export async function resendDocumentVersion(documentVersionId: string, actorId?: string) {
  return sendDocumentVersion({ documentVersionId, actorId, forceResend: true })
}
