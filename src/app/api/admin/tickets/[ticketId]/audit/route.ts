import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { getTicketAuditTimeline } from "@/infrastructure/tickets/ticketRead.service"
import { presentTicketAuditItem } from "@/interface/presenters/ticket.presenter"

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request, ctx: { params: Promise<{ ticketId: string }> }): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const { ticketId } = await ctx.params
  const items = await getTicketAuditTimeline(ticketId)
  const data = items.map((it) => presentTicketAuditItem(it))
  return respondOk(req, data, 200)
})
