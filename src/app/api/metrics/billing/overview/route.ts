import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk, respondError } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"

export const runtime = "nodejs"

function isValidMonth(s: string): boolean {
  return /^\d{4}-\d{2}$/.test(s)
}
function startOfMonthUTC(month: string): Date {
  const [y, m] = month.split("-").map((x) => Number(x))
  return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0))
}
function endOfMonthUTC(month: string): Date {
  const [y, m] = month.split("-").map((x) => Number(x))
  const d = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0))
  d.setUTCMilliseconds(-1)
  return d
}
function fmtDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const url = new URL(req.url)
  const monthParam = url.searchParams.get("month")
  let month: string
  if (monthParam && !isValidMonth(monthParam)) {
    return respondError(req, "VALIDATION_ERROR", "Invalid month format (expected YYYY-MM)", 400)
  }
  if (monthParam) {
    month = monthParam
  } else {
    const now = new Date()
    const y = now.getUTCFullYear()
    const m = String(now.getUTCMonth() + 1).padStart(2, "0")
    month = `${y}-${m}`
  }
  const start = startOfMonthUTC(month)
  const end = endOfMonthUTC(month)

  const invoices = await prisma.invoice.findMany({
    where: { periodMonth: month },
    orderBy: { issuedAt: "asc" },
    take: 2000,
  })
  type Row = Awaited<ReturnType<typeof prisma.invoice.findMany>>[number]
  const issuedCount = invoices.filter((r: Row) => String(r.status) !== "CANCELLED").length
  const sentCount = invoices.filter((r: Row) => String(r.status) === "SENT").length
  const paidCount = invoices.filter((r: Row) => String(r.status) === "PAID").length
  const unpaidCount = invoices.filter((r: Row) => String(r.status) === "SENT" && !r.paidAt).length
  const paidTotal = invoices.filter((r: Row) => String(r.status) === "PAID").reduce((sum, r) => sum + Number(r.totalAmount || 0), 0)
  const unpaidTotal = invoices.filter((r: Row) => String(r.status) === "SENT" && !r.paidAt).reduce((sum, r) => sum + Number(r.totalAmount || 0), 0)

  const days: string[] = []
  {
    const cur = new Date(start)
    while (cur <= end) {
      days.push(fmtDate(cur))
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
  }
  const sentDaily = days.map((d) => ({
    date: d,
    count: invoices.filter((r: Row) => r.sentAt && fmtDate(r.sentAt) === d).length,
  }))
  const paidDaily = days.map((d) => ({
    date: d,
    count: invoices.filter((r: Row) => r.paidAt && fmtDate(r.paidAt) === d).length,
  }))

  const payload = {
    periodMonth: month,
    totals: { issuedCount, sentCount, paidCount, unpaidCount },
    amounts: { paidTotal, unpaidTotal },
    trends: { sentDaily, paidDaily },
  }
  return respondOk(req, payload, 200)
})

