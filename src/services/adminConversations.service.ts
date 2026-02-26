import { prisma } from '@/lib/db'
import { logAudit } from '@/services/audit'
import { sendWithDeliveryLog } from '@/services/lineDelivery'
import { getLineAccessTokenPreferDb } from '@/lib/config/env'
import { DomainError } from '@/domain/errors'

async function getLineProfile(userId: string): Promise<string | null> {
  let token = ''
  try {
    token = await getLineAccessTokenPreferDb()
  } catch {
    return null
  }
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(userId)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!res.ok) return null
    const json = await res.json() as { displayName?: string }
    return json.displayName ?? null
  } catch {
    return null
  }
}

export async function listInbox(limit = 50) {
  const items = await prisma.conversation.findMany({
    orderBy: { lastMessageAt: 'desc' },
    take: limit,
    include: {
      messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { text: true, createdAt: true } }
    }
  })
  const lineUserIds = (items as Array<{ lineUserId: string | null }>).map((i: { lineUserId: string | null }) => i.lineUserId).filter((v: string | null): v is string => !!v)
  const bindings = await prisma.lineBinding.findMany({
    where: { lineUserId: { in: lineUserIds } },
    select: { lineUserId: true, roomNumber: true }
  })
  const bindingMap = new Map((bindings as Array<{ lineUserId: string; roomNumber: string }>).map((b: { lineUserId: string; roomNumber: string }) => [b.lineUserId, b.roomNumber] as const))
  const uniqueLineUsers = Array.from(new Set(lineUserIds))
  const profiles = await Promise.all(uniqueLineUsers.map(async (lu) => [lu, await getLineProfile(lu)] as const))
  const profileMap = new Map<string, string | null>(profiles)
  const result: Array<{
    id: string
    lineUserId: string
    displayName: string
    unreadAdmin: number
    lastMessageAt: Date
    lastMessage: string | null
    roomNumber: string | null
  }> = []
  for (const it of items as Array<{ id: string; lineUserId: string | null; unreadAdmin: number; lastMessageAt: Date; roomNumber: string | null; messages: Array<{ text: string; createdAt: Date }> }>) {
    const lu: string = it.lineUserId ?? ''
    const roomNo: string | null = bindingMap.get(lu) ?? it.roomNumber ?? null
    const lineName: string | null = lu ? (profileMap.get(lu) ?? null) : null
    const displayName: string = roomNo && lineName ? `${roomNo} - ${lineName}` : (lineName ?? lu)
    result.push({
      id: it.id,
      lineUserId: lu,
      displayName,
      unreadAdmin: it.unreadAdmin,
      lastMessageAt: it.lastMessageAt,
      lastMessage: it.messages[0]?.text ?? null,
      roomNumber: roomNo
    })
  }
  return result
}

export async function listMessages(conversationId: string, limit = 200) {
  const msgs = await prisma.conversationMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, sender: true, text: true, createdAt: true },
    take: limit
  })
  return msgs
}

export async function sendMessage(conversationId: string, content: string, actorId?: string) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { roomNumber: true }
  })
  if (conv?.roomNumber) {
    const [openCount, closedCount] = await Promise.all([
      prisma.ticket.count({ where: { roomNumber: conv.roomNumber, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      prisma.ticket.count({ where: { roomNumber: conv.roomNumber, status: 'CLOSED' } })
    ])
    if (closedCount > 0 && openCount === 0) {
      throw new DomainError('TICKET_CLOSED_REPLY_DISABLED', 'Reply disabled for closed ticket context', 409)
    }
  }
  const res = await sendWithDeliveryLog(conversationId, content)
  await logAudit({ actorId: actorId ?? 'system', action: 'CONVERSATION_SEND', entity: 'Conversation', entityId: conversationId, metadata: { delivery: res.status } })
  return { ok: true as const, status: res.status }
}

export async function markRead(conversationId: string, actorId?: string) {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { unreadAdmin: 0 }
  })
  await logAudit({ actorId: actorId ?? 'system', action: 'CONVERSATION_MARK_READ', entity: 'Conversation', entityId: conversationId })
  return { ok: true as const }
}
