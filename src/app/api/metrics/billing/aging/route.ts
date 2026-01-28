import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk, respondError } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import type { BillingAgingMetricsDTO, AgingBucketOrderedItemDTO } from "@/application/dto/billing-aging.dto"

export const runtime = "nodejs"

type AgingBucket = { count: number; totalAmount: number }
type AgingTotals = { overdueCount: number; overdueAmount: number; issuedCount: number; overduePercentOfIssued: number }
const FRESHNESS_THRESHOLD_MS = 15 * 60 * 1000

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
function daysBetweenUTC(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime()
  return Math.floor(ms / (24 * 60 * 60 * 1000))
}
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function computeAgingBucketsAndTotals(
  invoices: Array<{ status: unknown; dueDate: unknown; totalAmount: unknown; paidAt: unknown }>,
  now: Date,
): { buckets: { d0_7: AgingBucket; d8_30: AgingBucket; d31_plus: AgingBucket }; totals: AgingTotals } {
  let d0_7_count = 0
  let d8_30_count = 0
  let d31_plus_count = 0
  let d0_7_amount = 0
  let d8_30_amount = 0
  let d31_plus_amount = 0

  const issuedCount = invoices.filter((r) => {
    const s = String(r.status)
    return s === "SENT" || s === "PAID"
  }).length

  for (const inv of invoices) {
    const status = String(inv.status)
    const unpaid = status === "SENT" && !(inv.paidAt instanceof Date)
    if (!unpaid) continue
    if (!(inv.dueDate instanceof Date)) continue
    if (now < inv.dueDate) continue
    const overdueDays = daysBetweenUTC(now, inv.dueDate)
    const amt = Number(inv.totalAmount || 0)
    if (overdueDays <= 7) {
      d0_7_count++
      d0_7_amount += amt
    } else if (overdueDays <= 30) {
      d8_30_count++
      d8_30_amount += amt
    } else {
      d31_plus_count++
      d31_plus_amount += amt
    }
  }
  const overdueCount = d0_7_count + d8_30_count + d31_plus_count
  const overdueAmount = d0_7_amount + d8_30_amount + d31_plus_amount
  const overduePercentOfIssued = issuedCount > 0 ? round2((overdueCount / issuedCount) * 100) : 0
  return {
    buckets: {
      d0_7: { count: d0_7_count, totalAmount: d0_7_amount },
      d8_30: { count: d8_30_count, totalAmount: d8_30_amount },
      d31_plus: { count: d31_plus_count, totalAmount: d31_plus_amount },
    },
    totals: { overdueCount, overdueAmount, issuedCount, overduePercentOfIssued },
  }
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
  const calculatedAt = new Date()

  const invoices = await prisma.invoice.findMany({
    where: { periodMonth: month },
    select: { status: true, dueDate: true, totalAmount: true, paidAt: true },
    take: 5000,
  })
  const { buckets, totals } = computeAgingBucketsAndTotals(invoices, calculatedAt)
  const bucketsOrdered: ReadonlyArray<AgingBucketOrderedItemDTO> = [
    { key: "d0_7", label: "0–7 days", count: buckets.d0_7.count, totalAmount: buckets.d0_7.totalAmount },
    { key: "d8_30", label: "8–30 days", count: buckets.d8_30.count, totalAmount: buckets.d8_30.totalAmount },
    { key: "d31_plus", label: "31+ days", count: buckets.d31_plus.count, totalAmount: buckets.d31_plus.totalAmount },
  ]
  const nowCheck = new Date()
  const freshnessMs = Math.max(0, nowCheck.getTime() - calculatedAt.getTime())
  const isStale = freshnessMs > FRESHNESS_THRESHOLD_MS
  // status semantics: OK when fresh and consistent; STALE when isStale; INCONSISTENT when sums mismatch (non-blocking)
  const orderedCountSum = bucketsOrdered.reduce((acc, b) => acc + b.count, 0)
  const orderedAmountSum = bucketsOrdered.reduce((acc, b) => acc + b.totalAmount, 0)
  const inconsistent = orderedCountSum !== totals.overdueCount || orderedAmountSum !== totals.overdueAmount
  if (inconsistent) {
    const requestId = req.headers.get("x-request-id") || "unknown"
    console.warn(
      JSON.stringify({
        requestId,
        message: "BillingAgingMetrics inconsistency detected",
        orderedCountSum,
        overdueCount: totals.overdueCount,
        orderedAmountSum,
        overdueAmount: totals.overdueAmount,
      }),
    )
  }
  const status: BillingAgingMetricsDTO["meta"]["status"] = inconsistent ? "INCONSISTENT" : isStale ? "STALE" : "OK"
  const payload: BillingAgingMetricsDTO = {
    periodMonth: month,
    buckets,
    bucketsOrdered,
    totals,
    range: { start: start.toISOString(), end: end.toISOString() },
    meta: { calculatedAt: calculatedAt.toISOString(), version: "billing-aging@v1", freshnessMs, isStale, status },
  }
  return respondOk<BillingAgingMetricsDTO>(req, payload, 200)
})
