import type { AuditTargetType } from "@/domain/audit/audit.types"

export type InboundMessageInput = {
  ticketId: string
  messageText: string
}

export type TicketMessageRecord = {
  id: string
  ticketId: string
  direction: "INBOUND" | "OUTBOUND"
  channel: "LINE"
  messageText: string
  createdAt: Date
}

export interface TicketMessageGateway {
  create(input: { ticketId: string; direction: "INBOUND" | "OUTBOUND"; channel: "LINE"; messageText: string; createdAt: Date }): Promise<TicketMessageRecord>
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

export async function recordInboundMessage(
  input: InboundMessageInput,
  messages: TicketMessageGateway,
  audit: AuditEmitter,
): Promise<string> {
  if (!input.ticketId || !input.messageText) {
    throw domainError("VALIDATION_ERROR", "Invalid inbound message")
  }
  const createdAt = new Date()
  const rec = await messages.create({
    ticketId: input.ticketId,
    direction: "INBOUND",
    channel: "LINE",
    messageText: input.messageText,
    createdAt,
  })
  await audit.emit({
    actorType: "SYSTEM",
    action: "TICKET_MESSAGE_RECEIVED",
    targetType: "TICKET",
    targetId: input.ticketId,
    severity: "INFO",
    before: null,
    after: {
      ticketId: input.ticketId,
      direction: "INBOUND",
      channel: "LINE",
      messageText: input.messageText,
      createdAt: createdAt.toISOString(),
    },
  })
  return rec.id
}
