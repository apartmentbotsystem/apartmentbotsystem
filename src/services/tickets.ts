import { prisma } from '@/lib/db'
import { NotFoundError } from '@/domain/errors'
import type { AuthUser } from '@/lib/auth/types'
import { assertAuthenticated } from '@/lib/auth/guard'
import { requireRole } from '@/lib/auth/roles'
import { logAudit } from '@/services/audit'

export async function listTickets(user: AuthUser | null) {
  assertAuthenticated(user)
  requireRole(user.role, ['OWNER', 'ADMIN', 'STAFF'])
  return prisma.ticket.findMany({
    orderBy: { createdAt: 'desc' },
    include: { room: true, resident: true }
  })
}

export async function createTicket(user: AuthUser | null, params: { roomNumber: string; residentId?: string; text: string }, actorId: string) {
  assertAuthenticated(user)
  requireRole(user.role, ['OWNER', 'ADMIN', 'STAFF'])
  const room = await prisma.room.findUnique({
    where: { number: params.roomNumber },
    select: { id: true }
  })
  if (!room) throw new NotFoundError('room not found')
  const t = await prisma.ticket.create({
    data: {
      roomId: room.id,
      roomNumber: params.roomNumber,
      title: params.text.slice(0, 120),
      residentId: params.residentId ?? null,
      messages: { create: { sender: 'ADMIN', text: params.text } }
    }
  })
  await logAudit({ actorId, action: 'TICKET_CREATE', entity: 'Ticket', entityId: t.id })
  return { id: t.id }
}

export async function getTicket(user: AuthUser | null, id: string) {
  assertAuthenticated(user)
  requireRole(user.role, ['OWNER', 'ADMIN', 'STAFF'])
  return prisma.ticket.findFirst({
    where: { id },
    include: { messages: true, room: true, resident: true }
  })
}

export async function updateStatus(user: AuthUser | null, id: string, status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED') {
  assertAuthenticated(user)
  requireRole(user.role, ['OWNER', 'ADMIN', 'STAFF'])
  await prisma.ticket.updateMany({
    where: { id },
    data: { status }
  })
  await logAudit({ actorId: user.id, action: 'TICKET_STATUS', entity: 'Ticket', entityId: id, metadata: { status } })
  return { id, status }
}

export async function addMessage(user: AuthUser | null, ticketId: string, text: string, sender: 'ADMIN' | 'RESIDENT') {
  assertAuthenticated(user)
  requireRole(user.role, ['OWNER', 'ADMIN', 'STAFF'])
  const m = await prisma.ticketMessage.create({
    data: { ticketId, sender, text }
  })
  await logAudit({ actorId: user.id, action: 'TICKET_MESSAGE', entity: 'Ticket', entityId: ticketId })
  return { id: m.id }
}
