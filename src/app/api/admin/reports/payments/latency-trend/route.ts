import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { ValidationError } from "@/interface/errors/ValidationError"
import { PaymentLatencyTrendDTO } from "@/interface/validators/report.schema"

export const runtime = "nodejs"

function nthSmallest(values: number[], k: number): number {
  let arr = values.slice()
  while (true) {
    if (arr.length === 0) return 0
    const pivot = arr[Math.floor(Math.random() * arr.length)]
    const lt: number[] = []
    const eq: number[] = []
    const gt: number[] = []
    for (const v of arr) {
      if (v < pivot) lt.push(v)
      else if (v > pivot) gt.push(v)
      else eq.push(v)
    }
    if (k < lt.length) {
      arr = lt
    } else if (k < lt.length + eq.length) {
      return pivot
    } else {
      k = k - lt.length - eq.length
      arr = gt
    }
  }
}

function stats(values: number[]): { avg: number; median: number; p95: number } {
  if (values.length === 0) return { avg: 0, median: 0, p95: 0 }
  const sum = values.reduce((a, b) => a + b, 0)
  const avg = sum / values.length
  const mid = Math.floor(values.length / 2)
  const median = nthSmallest(values, mid)
  const idx95 = Math.ceil(values.length * 0.95) - 1
  const p95 = nthSmallest(values, Math.max(0, Math.min(values.length - 1, idx95)))
  return { avg, median, p95 }
}

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const url = new URL(req.url)
  const period = url.searchParams.get("period") || ""
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new ValidationError("Invalid period format, expected YYYY-MM")
  }
  const [y, m] = period.split("-").map((s) => Number(s))
  const prev = m > 1 ? `${y}-${String(m - 1).padStart(2, "0")}` : `${y - 1}-12`
  const curRows = await prisma.invoice.findMany({
    where: { periodMonth: period, status: "PAID" },
    take: 2000,
  })
  const prevRows = await prisma.invoice.findMany({
    where: { periodMonth: prev, status: "PAID" },
    take: 2000,
  })
  function collectDays(rows: Array<{ issuedAt: Date | string | null; paidAt: Date | string | null }>): number[] {
    const days: number[] = []
    for (const r of rows) {
      const issuedAt = r.issuedAt instanceof Date ? r.issuedAt : r.issuedAt ? new Date(r.issuedAt) : null
      const paidAt = r.paidAt instanceof Date ? r.paidAt : r.paidAt ? new Date(r.paidAt) : null
      if (issuedAt && paidAt) {
        const diffMs = paidAt.getTime() - issuedAt.getTime()
        const d = diffMs > 0 ? Math.floor(diffMs / (24 * 60 * 60 * 1000)) : 0
        days.push(d)
      }
    }
    return days
  }
  const curStats = stats(collectDays(curRows))
  const prevStats = stats(collectDays(prevRows))
  const direction = curStats.avg > prevStats.avg ? "UP" : curStats.avg < prevStats.avg ? "DOWN" : "FLAT"
  const payload = {
    periodMonth: period,
    avgLatency: curStats.avg,
    medianLatency: curStats.median,
    p95Latency: curStats.p95,
    trendDirection: direction as "UP" | "DOWN" | "FLAT",
  }
  PaymentLatencyTrendDTO.parse(payload)
  return respondOk(req, payload, 200)
})
