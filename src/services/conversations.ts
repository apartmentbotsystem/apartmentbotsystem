import { prisma } from '@/lib/db'
import type { AuthUser } from '@/lib/auth/types'
import { assertAuthenticated } from '@/lib/auth/guard'
import { requireRole } from '@/lib/auth/roles'

export async function listConversations(user: AuthUser | null) {
  assertAuthenticated(user)
  requireRole(user.role, ['OWNER', 'ADMIN', 'STAFF'])
  return prisma.conversation.findMany({
    orderBy: { createdAt: 'desc' },
    include: { room: true, resident: true }
  })
}

export async function listMessages(user: AuthUser | null, conversationId: string) {
  assertAuthenticated(user)
  requireRole(user.role, ['OWNER', 'ADMIN', 'STAFF'])
  return prisma.conversationMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' }
  })
}

export async function addMessage(user: AuthUser | null, conversationId: string, text: string, sender: 'ADMIN' | 'RESIDENT') {
  assertAuthenticated(user)
  requireRole(user.role, ['OWNER', 'ADMIN', 'STAFF'])
  const m = await prisma.conversationMessage.create({
    data: { conversationId, text, sender }
  })
  return { id: m.id }
}
