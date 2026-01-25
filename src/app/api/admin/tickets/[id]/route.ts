import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { getTicketDetail } from "@/infrastructure/tickets/ticketRead.service"
import { presentTicketDetail } from "@/interface/presenters/ticket.presenter"

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const { id } = await ctx.params
  const detail = await getTicketDetail(id)
  const data = presentTicketDetail(detail)
  return respondOk(req, data, 200)
})
