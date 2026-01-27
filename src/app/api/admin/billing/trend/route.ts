import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"

function monthStringUTC(d: Date): string {
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  const mm = m < 10 ? `0${m}` : String(m)
  return `${y}-${mm}`
}

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const now = new Date()
  const months: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    months.push(monthStringUTC(d))
  }
  const rows = await prisma.invoice.findMany({
    where: { periodMonth: { in: months } },
    select: { periodMonth: true, status: true, totalAmount: true },
    orderBy: [{ periodMonth: "asc" }, { issuedAt: "asc" }],
    take: 20000,
  })
  type Row = Awaited<ReturnType<typeof prisma.invoice.findMany>>[number]
  const byMonth = new Map<string, { billed: number; collected: number }>()
  months.forEach((m) => byMonth.set(m, { billed: 0, collected: 0 }))
  rows.forEach((r: Row) => {
    const key = r.periodMonth
    const bucket = byMonth.get(key)
    if (!bucket) return
    const amt = Number(r.totalAmount)
    if (r.status === "SENT" || r.status === "PAID") bucket.billed += amt
    if (r.status === "PAID") bucket.collected += amt
  })
  const items = months.map((m) => {
    const b = byMonth.get(m) || { billed: 0, collected: 0 }
    const rate = b.billed > 0 ? (b.collected / b.billed) * 100 : 0
    return { month: m, billed: b.billed, collected: b.collected, collectionRate: rate }
  })
  return respondOk(req, { items }, 200)
})

