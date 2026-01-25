import type { AuditTargetType } from "@/domain/audit/audit.types"

export type TicketReplyInput = {
  ticketId: string
  messageText: string
  actor: "ADMIN"
}

export type TicketMessageRecord = {
  id: string
  ticketId: string
  direction: "INBOUND" | "OUTBOUND"
  channel: "LINE"
  messageText: string
  createdAt: Date
}

export type TicketOutboxRecord = {
  id: string
  ticketId: string
  channel: "LINE"
  payload: Record<string, unknown>
  status: "PENDING" | "SENT" | "FAILED"
  createdAt: Date
  sentAt?: Date | null
}

export interface TicketMessageGateway {
  create(input: { ticketId: string; direction: "INBOUND" | "OUTBOUND"; channel: "LINE"; messageText: string; createdAt: Date }): Promise<TicketMessageRecord>
}

export interface TicketOutboxGateway {
  create(input: { ticketId: string; channel: "LINE"; payload: Record<string, unknown>; status: "PENDING"; createdAt: Date }): Promise<TicketOutboxRecord>
}

export interface AuditEmitter {
  emit(input: {
    actorType: "ADMIN" | "STAFF" | "SYSTEM"
    actorId?: string | null
    action: string
    targetType: AuditTargetType
    targetId?: string | null
    severity: "INFO" | "WARN" | "CRITICAL"
    before?: Record<string, unknown> | null
    after?: Record<string, unknown> | null
  }): Promise<void>
}

function domainError(code: string, message: string): Error {
  return Object.assign(new Error(message), { name: "DomainError", code })
}

export async function replyToTicket(
  input: TicketReplyInput,
  messages: TicketMessageGateway,
  outbox: TicketOutboxGateway,
  audit: AuditEmitter,
): Promise<{ messageId: string; outboxId: string }> {
  if (input.actor !== "ADMIN" || !input.ticketId || !input.messageText) {
    throw domainError("VALIDATION_ERROR", "Invalid reply input")
  }
  const createdAt = new Date()
  const msg = await messages.create({
    ticketId: input.ticketId,
    direction: "OUTBOUND",
    channel: "LINE",
    messageText: input.messageText,
    createdAt,
  })
  const payload = { channel: "LINE", messageText: input.messageText }
  const ob = await outbox.create({
    ticketId: input.ticketId,
    channel: "LINE",
    payload,
    status: "PENDING",
    createdAt,
  })
  await audit.emit({
    actorType: "ADMIN",
    action: "TICKET_MESSAGE_SENT",
    targetType: "TICKET",
    targetId: input.ticketId,
    severity: "INFO",
    before: null,
    after: {
      ticketId: input.ticketId,
      direction: "OUTBOUND",
      channel: "LINE",
      messageText: input.messageText,
      createdAt: createdAt.toISOString(),
      outboxStatus: "PENDING",
    },
  })
  return { messageId: msg.id, outboxId: ob.id }
}
