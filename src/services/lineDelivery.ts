import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { sendLineMessage } from '@/infrastructure/lineGateway'

export async function sendWithDeliveryLog(conversationId: string, text: string): Promise<{ status: 'sent' | 'failed' }> {
  let lineUserId: string = ''
  let messageId: string = ''
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

export async function sendMediaWithDeliveryLog(conversationId: string, file: { buffer: Buffer; contentType: string; fileName: string }, text: string = ''): Promise<{ status: 'sent' | 'failed'; mediaUrl?: string | null }> {
  let lineUserId: string = ''
  let messageId: string = ''
  let mediaPath: string | null = null
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const conv = await tx.conversation.findUnique({ where: { id: conversationId } })
    if (!conv || !conv.lineUserId) {
      throw new Error('NO_LINE_USER')
    }
    lineUserId = conv.lineUserId
    // Skipping upload in this environment; keep mediaPath null
    mediaPath = null
    const m = await tx.conversationMessage.create({
      data: {
        conversationId,
        sender: 'ADMIN',
        text: text || '[media]',
        mediaType: file.contentType,
        mediaPath: mediaPath ?? undefined,
        fileName: file.fileName,
        fileSize: file.buffer.byteLength
      }
    })
    messageId = m.id
    await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } })
    await tx.messageDeliveryLog.create({
      data: {
        referenceId: messageId,
        lineUserId: lineUserId,
        status: 'pending',
        retryCount: 0
      }
    })
  })
  // Attempt send and log response/error; do not throw to avoid blocking UI
  try {
    const content = text || '[media]'
    await sendLineMessage({ roomNumber: lineUserId, text: content })
    await prisma.messageDeliveryLog.update({
      where: { referenceId: messageId },
      data: { status: 'sent', sentAt: new Date() }
    })
    return { status: 'sent', mediaUrl: null }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : 'send failed'
    await prisma.messageDeliveryLog.update({
      where: { referenceId: messageId },
      data: { status: 'failed', errorMessage: errMsg }
    })
    return { status: 'failed', mediaUrl: null }
  }
}
