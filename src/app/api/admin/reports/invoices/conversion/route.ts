import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { ValidationError } from "@/interface/errors/ValidationError"
import { InvoiceConversionSummaryDTO } from "@/interface/validators/report.schema"

export const runtime = "nodejs"

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime()
  return ms > 0 ? Math.floor(ms / (24 * 60 * 60 * 1000)) : 0
}

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
  const issuedCount = rows.length
  const paidCount = rows.filter((r) => String(r.status) === "PAID").length
  const conversionRate = issuedCount > 0 ? paidCount / issuedCount : 0
  const now = new Date()
  let d0_7 = 0
  let d8_14 = 0
  let d15_30 = 0
  let d31_plus = 0
  for (const r of rows) {
    if (String(r.status) === "SENT" && !r.paidAt) {
      const base = r.sentAt ? (r.sentAt instanceof Date ? r.sentAt : new Date(r.sentAt)) : r.issuedAt ? (r.issuedAt instanceof Date ? r.issuedAt : new Date(r.issuedAt)) : null
      if (base) {
        const d = daysBetween(base, now)
        if (d <= 7) d0_7 += 1
        else if (d <= 14) d8_14 += 1
        else if (d <= 30) d15_30 += 1
        else d31_plus += 1
      }
    }
  }
  const payload = {
    periodMonth: period,
    issuedCount,
    paidCount,
    conversionRate,
    unpaidAgingBuckets: { d0_7, d8_14, d15_30, d31_plus },
  }
  InvoiceConversionSummaryDTO.parse(payload)
  return respondOk(req, payload, 200)
})
