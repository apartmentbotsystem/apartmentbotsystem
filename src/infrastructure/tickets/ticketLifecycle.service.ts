import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { domainTransaction } from "@/infrastructure/db/domainTransaction"
import { emitAuditEvent } from "@/infrastructure/audit/audit.service"

function domainError(code: string, message: string): Error {
  return Object.assign(new Error(message), { name: "DomainError", code })
}

export async function assignTicket(ticketId: string, adminId: string): Promise<void> {
  await domainTransaction(async () => {
    const current = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true, status: true } })
    if (!current) throw domainError("TICKET_NOT_FOUND", "Ticket not found")
    if (current.status === "CLOSED") throw domainError("TICKET_ALREADY_CLOSED", "Ticket already closed")
    const lastAssign = await prisma.auditEvent.findFirst({
      where: { targetType: "TICKET", targetId: ticketId, action: "TICKET_ASSIGNED" },
      orderBy: { timestamp: "desc" },
      select: { metadata: true },
    })
    const lastAdminId =
      lastAssign && lastAssign.metadata && typeof (lastAssign.metadata as Record<string, unknown>)["adminId"] === "string"
        ? ((lastAssign.metadata as Record<string, unknown>)["adminId"] as string)
        : null
    if (lastAdminId === adminId) return
    await emitAuditEvent({
      actorType: "ADMIN",
      actorId: adminId,
      action: "TICKET_ASSIGNED",
      targetType: "TICKET",
      targetId: current.id,
      severity: "INFO",
      before: { status: current.status },
      after: { status: current.status },
      metadata: { adminId },
    })
  })
}

export async function startTicket(ticketId: string, adminId: string): Promise<void> {
  await domainTransaction(async () => {
    const current = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true, status: true } })
    if (!current) throw domainError("TICKET_NOT_FOUND", "Ticket not found")
    if (current.status === "CLOSED") throw domainError("TICKET_ALREADY_CLOSED", "Ticket already closed")
    if (current.status !== "OPEN") throw domainError("INVALID_TICKET_STATUS", "Invalid ticket status")
    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: "IN_PROGRESS" },
      select: { id: true, status: true },
    })
    await emitAuditEvent({
      actorType: "ADMIN",
      actorId: adminId,
      action: "TICKET_STARTED",
      targetType: "TICKET",
      targetId: updated.id,
      severity: "INFO",
      before: { status: current.status },
      after: { status: updated.status },
      metadata: { adminId },
    })
  })
}

export async function closeTicket(ticketId: string, adminId: string): Promise<void> {
  await domainTransaction(async () => {
    const current = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true, status: true } })
    if (!current) throw domainError("TICKET_NOT_FOUND", "Ticket not found")
    if (current.status === "CLOSED") throw domainError("TICKET_ALREADY_CLOSED", "Ticket already closed")
    if (current.status !== "IN_PROGRESS") throw domainError("INVALID_TICKET_STATUS", "Invalid ticket status")
    const closedAt = new Date()
    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: "CLOSED", closedAt },
      select: { id: true, status: true, closedAt: true },
    })
    await emitAuditEvent({
      actorType: "ADMIN",
      actorId: adminId,
      action: "TICKET_CLOSED",
      targetType: "TICKET",
      targetId: updated.id,
      severity: "INFO",
      before: { status: current.status },
      after: { status: updated.status, closedAt: updated.closedAt ? updated.closedAt.toISOString() : null },
      metadata: { adminId },
    })
  })
}
