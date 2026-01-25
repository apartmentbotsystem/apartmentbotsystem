import { prisma } from "@/infrastructure/db/prisma/prismaClient"

export async function listTickets(input: {
  status?: "OPEN" | "IN_PROGRESS" | "CLOSED"
  source?: "LINE" | "MANUAL"
  roomId?: string
  tenantId?: string
  page?: number
  limit?: number
}): Promise<
  Array<{
    id: string
    source: "LINE"
    externalThreadId: string
    roomId: string | null
    tenantId: string | null
    title: string
    status: "OPEN" | "IN_PROGRESS" | "CLOSED"
    createdAt: Date
  }>
> {
  const take = Number.isFinite(input.limit) && input.limit && input.limit > 0 ? Math.min(input.limit, 200) : 50
  const page = Number.isFinite(input.page) && input.page && input.page > 0 ? input.page : 1
  const skip = (page - 1) * take
  const where: Record<string, unknown> = {}
  if (input.status) where["status"] = input.status
  if (input.source === "LINE") where["source"] = "LINE"
  if (input.source === "MANUAL") where["source"] = "MANUAL"
  if (input.roomId) where["roomId"] = input.roomId
  if (input.tenantId) where["tenantId"] = input.tenantId
  const rows = await prisma.ticket.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    skip,
  })
  type Row = Awaited<ReturnType<typeof prisma.ticket.findMany>>[number]
  return rows.map((r: Row) => ({
    id: r.id,
    source: r.source as "LINE",
    externalThreadId: r.externalThreadId,
    roomId: r.roomId ?? null,
    tenantId: r.tenantId ?? null,
    title: r.title,
    status: r.status as "OPEN" | "IN_PROGRESS" | "CLOSED",
    createdAt: r.createdAt,
  }))
}

export async function getTicketDetail(id: string): Promise<{
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
}> {
  const t = await prisma.ticket.findUnique({ where: { id } })
  if (!t) {
    throw Object.assign(new Error("Ticket not found"), { name: "DomainError", code: "TICKET_NOT_FOUND" })
  }
  const audits = await prisma.auditEvent.findMany({
    where: { targetType: "TICKET", targetId: id },
    orderBy: { timestamp: "asc" },
    select: { action: true, metadata: true, timestamp: true },
    take: 500,
  })
  let assignedAdminId: string | null = null
  for (let i = audits.length - 1; i >= 0; i--) {
    const a = audits[i]
    if (a.action === "TICKET_ASSIGNED") {
      const m = a.metadata as Record<string, unknown> | null
      const v = m && typeof m["adminId"] === "string" ? (m["adminId"] as string) : null
      if (v) {
        assignedAdminId = v
        break
      }
    }
  }
  const lastAuditAt = audits.length ? audits[audits.length - 1].timestamp : null
  const updatedAt = lastAuditAt ?? t.createdAt
  return {
    id: t.id,
    source: t.source as "LINE",
    externalThreadId: t.externalThreadId,
    roomId: t.roomId ?? null,
    tenantId: t.tenantId ?? null,
    title: t.title,
    status: t.status as "OPEN" | "IN_PROGRESS" | "CLOSED",
    assignedAdminId,
    createdAt: t.createdAt,
    updatedAt,
    closedAt: t.closedAt ?? null,
  }
}

export async function getTicketAuditTimeline(id: string): Promise<
  Array<{
    id: string
    timestamp: Date
    actorType: "ADMIN" | "STAFF" | "SYSTEM"
    actorId: string | null
    action: string
    severity: "INFO" | "WARN" | "CRITICAL"
    metadata: Record<string, unknown> | null
  }>
> {
  const rows = await prisma.auditEvent.findMany({
    where: { targetType: "TICKET", targetId: id },
    orderBy: { timestamp: "asc" },
    take: 500,
  })
  type Row = Awaited<ReturnType<typeof prisma.auditEvent.findMany>>[number]
  return rows.map((r: Row) => ({
    id: r.id,
    timestamp: r.timestamp,
    actorType: r.actorType as "ADMIN" | "STAFF" | "SYSTEM",
    actorId: r.actorId ?? null,
    action: r.action,
    severity: r.severity as "INFO" | "WARN" | "CRITICAL",
    metadata: (r.metadata ?? null) as Record<string, unknown> | null,
  }))
}
