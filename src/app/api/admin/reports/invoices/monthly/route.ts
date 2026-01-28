import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { ValidationError } from "@/interface/errors/ValidationError"
import { MonthlyInvoiceSummaryDTO } from "@/interface/validators/report.schema"

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const url = new URL(req.url)
  const period = url.searchParams.get("period") || ""
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new ValidationError("Invalid period format, expected YYYY-MM")
  }
  const rows = await prisma.invoice.findMany({
    where: { periodMonth: period },
    take: 2000,
  })
  const issued = rows.length
  const sent = rows.filter((r) => String(r.status) === "SENT").length
  const paidRows = rows.filter((r) => String(r.status) === "PAID")
  const paid = paidRows.length
  const unpaidRows = rows.filter((r) => String(r.status) === "SENT")
  const unpaid = unpaidRows.length
  const paidTotal = paidRows.reduce((acc, r) => acc + Number(r.totalAmount ?? 0), 0)
  const unpaidTotal = unpaidRows.reduce((acc, r) => acc + Number(r.totalAmount ?? 0), 0)
  const payload = {
    periodMonth: period,
    totals: { issued, sent, paid, unpaid },
    amounts: { paidTotal, unpaidTotal },
  }
  MonthlyInvoiceSummaryDTO.parse(payload)
  return respondOk(req, payload, 200)
})
