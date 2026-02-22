import { prisma } from '@/lib/db'
import { sendLineMessage as gatewaySendLineMessage, type LineSendPayload } from '@/infrastructure/lineGateway'

type SendLineMessageInput = {
  referenceId: string
  lineUserId: string
  messagePayload: { text: string }
}

export async function sendLineMessage(input: SendLineMessageInput): Promise<{ status: 'sent' | 'skipped' | 'failed'; attempts: number }> {
  const { referenceId, lineUserId, messagePayload } = input
  const existing = await prisma.messageDeliveryLog.findUnique({ where: { referenceId } })
  if (existing && existing.status.toLowerCase() === 'sent') {
    return { status: 'skipped', attempts: existing.retryCount + 1 }
  }
  let log = existing
  if (!log) {
    log = await prisma.messageDeliveryLog.create({
      data: {
        referenceId,
        lineUserId,
        status: 'pending',
        retryCount: 0
      }
    })
  }
  let attempts = 0
  for (; attempts < 3; attempts++) {
    try {
      const payload: LineSendPayload = { roomNumber: lineUserId, text: messagePayload.text }
      await gatewaySendLineMessage(payload)
      await prisma.messageDeliveryLog.update({
        where: { referenceId },
        data: { status: 'sent', sentAt: new Date(), retryCount: attempts }
      })
      return { status: 'sent', attempts: attempts + 1 }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'unknown error'
      await prisma.messageDeliveryLog.update({
        where: { referenceId },
        data: { status: 'pending', errorMessage: errMsg, retryCount: attempts + 1 }
      })
    }
  }
  await prisma.messageDeliveryLog.update({
    where: { referenceId },
    data: { status: 'failed' }
  })
  return { status: 'failed', attempts }
}
