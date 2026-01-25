export type TicketListItemDTO = {
  id: string
  source: "LINE"
  externalThreadId: string
  roomId: string | null
  tenantId: string | null
  title: string
  status: "OPEN" | "IN_PROGRESS" | "CLOSED"
  createdAt: string
}

export type TicketDetailDTO = {
  id: string
  source: "LINE"
  externalThreadId: string
  roomId: string | null
  tenantId: string | null
  title: string
  status: "OPEN" | "IN_PROGRESS" | "CLOSED"
  assignedAdminId: string | null
  createdAt: string
  updatedAt: string
  closedAt: string | null
}

export type TicketAuditItemDTO = {
  id: string
  timestamp: string
  actorType: "ADMIN" | "STAFF" | "SYSTEM"
  actorId: string | null
  action: string
  severity: "INFO" | "WARN" | "CRITICAL"
  metadata: Record<string, unknown> | null
}
