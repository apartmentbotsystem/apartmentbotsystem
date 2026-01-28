import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { getTicketDetail } from "@/infrastructure/tickets/ticketRead.service"
import { presentTicketDetail } from "@/interface/presenters/ticket.presenter"
import { ValidationError } from "@/interface/errors/ValidationError"

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request, ctx: { params: Promise<{ ticketId: string }> }): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const { ticketId } = await ctx.params
  if (!ticketId || typeof ticketId !== "string" || ticketId.trim().length === 0) {
    throw new ValidationError("Missing ticketId")
  }
  const detail = await getTicketDetail(ticketId)
  const data = presentTicketDetail(detail)
  return respondOk(req, data, 200)
})
