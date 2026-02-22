import { Prisma, DeliveryStatus, DeliveryChannel, DocumentStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { sendLineMessage } from '@/infrastructure/lineGateway'
import { DomainError } from '@/domain/errors'

type SendInput = { documentVersionId: string; actorId?: string; forceResend?: boolean }
type SendResult = { status: 'SUCCESS' | 'FAILED'; lineMessageId?: string }

export async function sendDocumentVersion(input: SendInput): Promise<SendResult> {
  const { documentVersionId, actorId, forceResend } = input
  const dv = await prisma.documentVersion.findUnique({ where: { id: documentVersionId } })
    if (!dv) throw new DomainError('NOT_FOUND', 'document version not found', 404)
    if (dv.status === 'SENT' && forceResend !== true) {
      throw new DomainError('ALREADY_SENT', 'already sent; force required to resend', 409)
    }
    const pending = await prisma.deliveryLog.create({
      data: {
        documentVersionId,
        channel: DeliveryChannel.LINE,
        status: DeliveryStatus.PENDING,
        sentBy: actorId ?? null
      }
    })
    try {
      const payload = { roomNumber: dv.roomNumber, text: `Document v${dv.versionNo}` }
      const { messageId } = await sendLineMessage(payload)
      await prisma.deliveryLog.update({ where: { id: pending.id }, data: { status: DeliveryStatus.SUCCESS, lineMessageId: messageId } })
      await prisma.documentVersion.update({ where: { id: dv.id }, data: { status: DocumentStatus.SENT } })
      await prisma.auditLog.create({
        data: { action: 'DOCUMENT_SENT', entityType: 'DocumentVersion', entityId: dv.id, data: { actorId, messageId }, billingRecordId: null }
      })
      const res: SendResult = { status: 'SUCCESS', lineMessageId: messageId }
      return res
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'send failed'
      await prisma.deliveryLog.update({ where: { id: pending.id }, data: { status: DeliveryStatus.FAILED, errorMessage: msg } })
      await prisma.documentVersion.update({ where: { id: dv.id }, data: { status: DocumentStatus.FAILED } })
      await prisma.auditLog.create({
        data: { action: 'DOCUMENT_SEND_FAILED', entityType: 'DocumentVersion', entityId: dv.id, data: { actorId, error: msg }, billingRecordId: null }
      })
      const res: SendResult = { status: 'FAILED' }
      return res
    }
  
}

export async function resendDocumentVersion(documentVersionId: string, actorId?: string) {
  return sendDocumentVersion({ documentVersionId, actorId, forceResend: true })
}
