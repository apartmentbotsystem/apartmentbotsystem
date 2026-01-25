import type { AuditTargetType } from "@/domain/audit/audit.types"

export type LineTicketIngestInput = {
  source: "LINE"
  externalThreadId: string
  messageText: string
  tenantId?: string
  roomId?: string
}

export type CreateTicketCommand = {
  source: "LINE"
  externalThreadId: string
  title: string
  tenantId?: string
  roomId?: string
  createdAt: Date
}

export type TicketRecord = {
  id: string
  source: "LINE"
  externalThreadId: string
  title: string
  status: "OPEN"
  tenantId?: string
  roomId?: string
  createdAt: Date
}

export interface TicketGateway {
  findByExternalThreadId(externalThreadId: string): Promise<TicketRecord | null>
  createOpen(command: CreateTicketCommand): Promise<TicketRecord>
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

function toCreateCommand(input: LineTicketIngestInput): CreateTicketCommand {
  const title = String(input.messageText || "").trim().slice(0, 120)
  return {
    source: "LINE",
    externalThreadId: input.externalThreadId,
    title,
    tenantId: input.tenantId,
    roomId: input.roomId,
    createdAt: new Date(),
  }
}

export async function createTicketFromLine(
  input: LineTicketIngestInput,
  gateway: TicketGateway,
  audit: AuditEmitter,
): Promise<string> {
  if (!input.externalThreadId || input.source !== "LINE") {
    throw domainError("VALIDATION_ERROR", "Invalid LINE ingest input")
  }
  const dup = await gateway.findByExternalThreadId(input.externalThreadId)
  if (dup) {
    throw domainError("EXTERNAL_THREAD_DUPLICATE", "External thread already exists")
  }
  const cmd = toCreateCommand(input)
  const created = await gateway.createOpen(cmd)
  const payload: Record<string, unknown> = {
    ticketId: created.id,
    source: "LINE",
    externalThreadId: created.externalThreadId,
    title: created.title,
    createdAt: cmd.createdAt.toISOString(),
  }
  if (typeof created.tenantId === "string") payload["tenantId"] = created.tenantId
  if (typeof created.roomId === "string") payload["roomId"] = created.roomId
  await audit.emit({
    actorType: "SYSTEM",
    action: "TICKET_CREATED",
    targetType: "TICKET",
    targetId: created.id,
    severity: "INFO",
    before: null,
    after: payload,
  })
  return created.id
}
