import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { AutomationDryRunResponseDTO, OverdueInvoicesCandidatesDTO, TicketsNoReplyCandidatesDTO } from "@/interface/validators/report.schema"
import { generateProposals } from "@/domain/automation/proposal"

export const runtime = "nodejs"

async function fetchEnvelope<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/vnd.apartment.v1.1+json" }, cache: "no-store" })
  const json = await res.json()
  if (json && typeof json === "object" && "success" in json) {
    if (json.success) return json.data as T
    const msg = (json.error && json.error.message) || "Error"
    throw new Error(String(msg))
  }
  return json as T
}

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const url = new URL(req.url)
  const period = url.searchParams.get("period") || ""
  const minOverdueDays = Number(url.searchParams.get("minOverdueDays") || "4")
  const thresholdDays = Number(url.searchParams.get("thresholdDays") || "3")
  const qs1 = period ? `?period=${encodeURIComponent(period)}` : ""
  const qs2 = `?thresholdDays=${encodeURIComponent(thresholdDays)}`
  const overdueData = await fetchEnvelope<{ items: unknown }>(`/api/admin/automation-candidates/invoices/overdue${qs1}`)
  const noReplyData = await fetchEnvelope<{ items: unknown }>(`/api/admin/automation-candidates/tickets/no-reply${qs2}`)
  const overdueParsed = OverdueInvoicesCandidatesDTO.parse(overdueData)
  const noReplyParsed = TicketsNoReplyCandidatesDTO.parse(noReplyData)
  const proposals = generateProposals({
    overdue: overdueParsed.items,
    noReply: noReplyParsed.items,
    minOverdueDays,
    thresholdDays,
  })
  const payload = { proposals }
  AutomationDryRunResponseDTO.parse(payload)
  return respondOk(req, payload, 200)
})
