import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { startTicket } from "@/infrastructure/tickets/ticketLifecycle.service"
import { getTicketDetail } from "@/infrastructure/tickets/ticketRead.service"
import { presentTicketDetail } from "@/interface/presenters/ticket.presenter"

export const runtime = "nodejs"

export const POST = withErrorHandling(async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const session = await requireRole(req, ["ADMIN"])
  const { id } = await ctx.params
  await startTicket(id, session.userId)
  const detail = await getTicketDetail(id)
  return respondOk(req, presentTicketDetail(detail), 200)
})
