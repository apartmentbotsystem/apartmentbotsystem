import type { TicketListItemDTO, TicketDetailDTO, TicketAuditItemDTO } from "@/application/dto/ticket.dto"

export function presentTicketListItem(it: {
  id: string
  source: "LINE"
  externalThreadId: string
  roomId: string | null
  tenantId: string | null
  title: string
  status: "OPEN" | "IN_PROGRESS" | "CLOSED"
  createdAt: Date
}): TicketListItemDTO {
  return {
    id: it.id,
    source: it.source,
    externalThreadId: it.externalThreadId,
    roomId: it.roomId ?? null,
    tenantId: it.tenantId ?? null,
    title: it.title,
    status: it.status,
    createdAt: it.createdAt.toISOString(),
  }
}

export function presentTicketDetail(it: {
  id: string
  source: "LINE"
  externalThreadId: string
  roomId: string | null
  tenantId: string | null
  title: string
  status: "OPEN" | "IN_PROGRESS" | "CLOSED"
  assignedAdminId: string | null
  createdAt: Date
  updatedAt: Date
  closedAt: Date | null
}): TicketDetailDTO {
  return {
    id: it.id,
    source: it.source,
    externalThreadId: it.externalThreadId,
    roomId: it.roomId ?? null,
    tenantId: it.tenantId ?? null,
    title: it.title,
    status: it.status,
    assignedAdminId: it.assignedAdminId ?? null,
    createdAt: it.createdAt.toISOString(),
    updatedAt: it.updatedAt.toISOString(),
    closedAt: it.closedAt ? it.closedAt.toISOString() : null,
  }
}

export function presentTicketAuditItem(it: {
  id: string
  timestamp: Date
  actorType: "ADMIN" | "STAFF" | "SYSTEM"
  actorId: string | null
  action: string
  severity: "INFO" | "WARN" | "CRITICAL"
  metadata: Record<string, unknown> | null
}): TicketAuditItemDTO {
  return {
    id: it.id,
    timestamp: it.timestamp.toISOString(),
    actorType: it.actorType,
    actorId: it.actorId ?? null,
    action: it.action,
    severity: it.severity,
    metadata: it.metadata ?? null,
  }
}
