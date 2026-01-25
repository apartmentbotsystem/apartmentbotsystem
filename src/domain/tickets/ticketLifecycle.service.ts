import type { AuditTargetType } from "@/domain/audit/audit.types"

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "CLOSED"

export type TicketEntity = {
  id: string
  status: TicketStatus
  closedAt: Date | null
}

export interface TicketLifecycleGateway {
  getById(id: string): Promise<TicketEntity | null>
  createOpen(data: { id?: string }): Promise<TicketEntity>
  setStatus(id: string, status: TicketStatus, closedAt?: Date | null): Promise<TicketEntity>
}

export interface AuditEmitter {
  emit(input: {
    actorType: "ADMIN" | "STAFF" | "SYSTEM"
    actorId: string
    action: string
    targetType: AuditTargetType
    targetId: string
    severity: "INFO" | "WARN" | "CRITICAL"
    before: Record<string, unknown> | null
    after: Record<string, unknown> | null
  }): Promise<void>
}

function domainError(code: string, message: string): Error {
  return Object.assign(new Error(message), { name: "DomainError", code })
}

export async function openTicket(
  gateway: TicketLifecycleGateway,
  audit: AuditEmitter,
  actorId: string,
  init?: { id?: string },
): Promise<TicketEntity> {
  const created = await gateway.createOpen(init ?? {})
  await audit.emit({
    actorType: "ADMIN",
    actorId,
    action: "TICKET_CREATED",
    targetType: "TICKET",
    targetId: created.id,
    severity: "INFO",
    before: null,
    after: { status: created.status, actor: actorId, timestamp: new Date().toISOString() },
  })
  return created
}

export async function startTicket(
  gateway: TicketLifecycleGateway,
  audit: AuditEmitter,
  ticketId: string,
  actorId: string,
): Promise<TicketEntity> {
  const current = await gateway.getById(ticketId)
  if (!current) throw domainError("TICKET_NOT_FOUND", "Ticket not found")
  if (current.status === "CLOSED") throw domainError("TICKET_ALREADY_CLOSED", "Ticket already closed")
  if (current.status !== "OPEN") throw domainError("INVALID_TICKET_STATUS", "Invalid ticket status")
  const updated = await gateway.setStatus(ticketId, "IN_PROGRESS")
  await audit.emit({
    actorType: "ADMIN",
    actorId,
    action: "TICKET_STARTED",
    targetType: "TICKET",
    targetId: updated.id,
    severity: "INFO",
    before: { status: current.status },
    after: { status: updated.status, actor: actorId, timestamp: new Date().toISOString() },
  })
  return updated
}

export async function closeTicket(
  gateway: TicketLifecycleGateway,
  audit: AuditEmitter,
  ticketId: string,
  actorId: string,
  reason?: string,
): Promise<TicketEntity> {
  const current = await gateway.getById(ticketId)
  if (!current) throw domainError("TICKET_NOT_FOUND", "Ticket not found")
  if (current.status === "CLOSED") throw domainError("TICKET_ALREADY_CLOSED", "Ticket already closed")
  if (current.status !== "IN_PROGRESS") throw domainError("INVALID_TICKET_STATUS", "Invalid ticket status")
  const closedAt = new Date()
  const updated = await gateway.setStatus(ticketId, "CLOSED", closedAt)
  await audit.emit({
    actorType: "ADMIN",
    actorId,
    action: "TICKET_CLOSED",
    targetType: "TICKET",
    targetId: updated.id,
    severity: "INFO",
    before: { status: current.status },
    after: { status: updated.status, actor: actorId, timestamp: closedAt.toISOString(), reason: reason ?? null },
  })
  return updated
}
