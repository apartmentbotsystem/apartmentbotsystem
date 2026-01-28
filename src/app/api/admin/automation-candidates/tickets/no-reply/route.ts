import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { TicketsNoReplyCandidatesDTO } from "@/interface/validators/report.schema"

export const runtime = "nodejs"

function daysBetweenUTC(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  const diffMs = b - a
  return Math.max(0, Math.floor(diffMs / 86_400_000))
}

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN", "STAFF"])
  const url = new URL(req.url)
  const thresholdDays = Number(url.searchParams.get("thresholdDays") || "3")
  const today = new Date()
  const tickets = await prisma.ticket.findMany({
    where: { OR: [{ status: "OPEN" }, { status: "IN_PROGRESS" }] },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 500,
  })
  type TicketRow = Awaited<ReturnType<typeof prisma.ticket.findMany>>[number]
  const ids = tickets.map((t: TicketRow) => t.id)
  const audits = ids.length
    ? await prisma.auditEvent.findMany({
        where: { targetType: "TICKET", targetId: { in: ids } },
        select: { targetId: true, action: true, timestamp: true },
        orderBy: { timestamp: "desc" },
        take: 2000,
      })
    : []
  type AuditRow = Awaited<ReturnType<typeof prisma.auditEvent.findMany>>[number]
  const lastReplyByTicket = new Map<string, Date>()
  for (const ev of audits as AuditRow[]) {
    if (ev.action === "TICKET_MESSAGE_SENT") {
      const prev = lastReplyByTicket.get(ev.targetId || "")
      if (!prev || ev.timestamp > prev) {
        lastReplyByTicket.set(ev.targetId || "", ev.timestamp)
      }
    }
  }
  const items = tickets
    .map((t: TicketRow) => {
      const last = lastReplyByTicket.get(t.id)
      const daysOpen = daysBetweenUTC(t.createdAt, today)
      const daysSinceReply = last ? daysBetweenUTC(last, today) : daysOpen
      return {
        ticketId: t.id,
        daysOpen,
        lastReplyAt: last ? last.toISOString() : undefined,
        _daysSinceReply: daysSinceReply,
      }
    })
    .filter((it) => it._daysSinceReply > thresholdDays)
    .map((it) => ({ ticketId: it.ticketId, daysOpen: it.daysOpen, lastReplyAt: it.lastReplyAt }))
  const payload = { items }
  TicketsNoReplyCandidatesDTO.parse(payload)
  return respondOk(req, payload, 200)
})
