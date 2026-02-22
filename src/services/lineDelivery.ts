import { prisma } from '@/lib/db'
import { sendLineMessage } from '@/infrastructure/lineGateway'

export async function sendWithDeliveryLog(conversationId: string, text: string): Promise<{ status: 'sent' | 'failed' }> {
  let lineUserId: string = ''
  let messageId: string = ''
  await prisma.$transaction(async (tx) => {
    const conv = await tx.conversation.findUnique({ where: { id: conversationId } })
    if (!conv || !conv.lineUserId) {
      throw new Error('NO_LINE_USER')
    }
    lineUserId = conv.lineUserId
    const m = await tx.conversationMessage.create({
      data: {
        conversationId,
        sender: 'ADMIN',
        text
      }
    })
    messageId = m.id
    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() }
    })
    await tx.messageDeliveryLog.create({
      data: {
        referenceId: messageId,
        lineUserId: lineUserId,
        status: 'pending',
        retryCount: 0
      }
    })
  })
  try {
    await sendLineMessage({ roomNumber: lineUserId, text })
    await prisma.messageDeliveryLog.update({
      where: { referenceId: messageId },
      data: { status: 'sent', sentAt: new Date() }
    })
    return { status: 'sent' }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : 'send failed'
    await prisma.messageDeliveryLog.update({
      where: { referenceId: messageId },
      data: { status: 'failed', errorMessage: errMsg }
    })
    throw e
  }
}
