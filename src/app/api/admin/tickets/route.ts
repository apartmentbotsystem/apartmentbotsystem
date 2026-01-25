import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { listTickets } from "@/infrastructure/tickets/ticketRead.service"
import { presentTicketListItem } from "@/interface/presenters/ticket.presenter"

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const url = new URL(req.url)
  const status = (url.searchParams.get("status") || undefined) as "OPEN" | "IN_PROGRESS" | "CLOSED" | undefined
  const source = (url.searchParams.get("source") || undefined) as "LINE" | "MANUAL" | undefined
  const roomId = url.searchParams.get("roomId") || undefined
  const tenantId = url.searchParams.get("tenantId") || undefined
  const page = Number(url.searchParams.get("page") || "1")
  const limit = Number(url.searchParams.get("limit") || "50")
  const items = await listTickets({ status, source, roomId, tenantId, page, limit })
  const data = items.map((it) => presentTicketListItem(it))
  return respondOk(req, data, 200)
})
