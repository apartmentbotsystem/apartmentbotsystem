import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { ValidationError } from "@/interface/errors/ValidationError"
import { PaymentLatencyStatsDTO } from "@/interface/validators/report.schema"

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
  const rows = await prisma.invoice.findMany({
    where: { periodMonth: period, status: "PAID" },
    take: 2000,
  })
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
  const { avg, median, p95 } = stats(days)
  const payload = {
    periodMonth: period,
    latencyDays: { avg, median, p95 },
  }
  PaymentLatencyStatsDTO.parse(payload)
  return respondOk(req, payload, 200)
})
