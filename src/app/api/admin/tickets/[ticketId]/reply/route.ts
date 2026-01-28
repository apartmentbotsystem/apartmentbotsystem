import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { ValidationError } from "@/interface/errors/ValidationError"
import { TicketMessageGatewayPrisma } from "@/infrastructure/tickets/TicketMessageGatewayPrisma"
import { TicketOutboxGatewayPrisma } from "@/infrastructure/tickets/TicketOutboxGatewayPrisma"
import { replyToTicket } from "@/modules/ticket/services/ticketReply.service"
import { emitAuditEvent } from "@/infrastructure/audit/audit.service"
import type { AuditEmitter as TicketAuditEmitter } from "@/modules/ticket/services/ticketReply.service"
import type { AuditEventInput } from "@/infrastructure/audit/audit.service"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"

export const runtime = "nodejs"

export const POST = withErrorHandling(async (req: Request, ctx: { params: Promise<Record<string, string>> }): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const params = await ctx.params
  const ticketId = params["ticketId"]
  const body = await req.json()
  const messageText = typeof body?.messageText === "string" ? body.messageText.trim() : ""
  if (!ticketId || !messageText) {
    throw new ValidationError("Invalid reply input")
  }
  const current = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { status: true } })
  if (!current) {
    throw Object.assign(new Error("Ticket not found"), { name: "DomainError", code: "TICKET_NOT_FOUND" })
  }
  if (current.status === "CLOSED") {
    throw Object.assign(new Error("Ticket already closed"), { name: "DomainError", code: "TICKET_ALREADY_CLOSED" })
  }
  const messages = new TicketMessageGatewayPrisma()
  const outbox = new TicketOutboxGatewayPrisma()
  const audit: TicketAuditEmitter = { emit: async (input) => emitAuditEvent(input as AuditEventInput) }
  const res = await replyToTicket({ ticketId, messageText, actor: "ADMIN" }, messages, outbox, audit)
  return respondOk(req, { messageId: res.messageId, outboxId: res.outboxId }, 201)
})
