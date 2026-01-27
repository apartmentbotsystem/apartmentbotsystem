import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { ValidationError } from "@/interface/errors/ValidationError"
import { isInvoiceOverdue } from "@/domain/invoice/isInvoiceOverdue"

function parseGraceDays(): number {
  const v = Number(process.env.INVOICE_GRACE_DAYS)
  if (!Number.isFinite(v) || v <= 0) return 5
  return Math.floor(v)
}

function calculateDueDate(periodMonth: string): Date {
  const parts = String(periodMonth).split("-")
  const year = Number(parts[0])
  const month = Number(parts[1])
  const end = new Date(Date.UTC(year, month, 0))
  const grace = parseGraceDays()
  return new Date(end.getTime() + grace * 24 * 60 * 60 * 1000)
}

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const url = new URL(req.url)
  const month = url.searchParams.get("month")
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new ValidationError("Invalid month format, expected YYYY-MM")
  }
  const rows = await prisma.invoice.findMany({
    where: { periodMonth: month },
    select: { totalAmount: true, status: true, paidAt: true, periodMonth: true },
    orderBy: { issuedAt: "asc" },
    take: 5000,
  })
  type Row = Awaited<ReturnType<typeof prisma.invoice.findMany>>[number]
  const billed = rows.reduce((sum: number, r: Row) => sum + (r.status === "SENT" || r.status === "PAID" ? Number(r.totalAmount) : 0), 0)
  const collected = rows.reduce((sum: number, r: Row) => sum + (r.status === "PAID" ? Number(r.totalAmount) : 0), 0)
  const outstanding = rows.reduce((sum: number, r: Row) => sum + (r.status === "SENT" ? Number(r.totalAmount) : 0), 0)
  const collectionRate = billed > 0 ? (collected / billed) * 100 : 0
  const due = calculateDueDate(month)
  let b0_7 = 0
  let b8_30 = 0
  let b31_60 = 0
  let b60_plus = 0
  const now = new Date()
  rows.forEach((r: Row) => {
    if (r.status !== "SENT") return
    const overdue = isInvoiceOverdue({ status: r.status as "DRAFT" | "SENT" | "PAID" | "CANCELLED", paidAt: r.paidAt, periodMonth: r.periodMonth }, now)
    if (!overdue) return
    const daysLate = Math.max(0, Math.floor((now.getTime() - due.getTime()) / (24 * 60 * 60 * 1000)))
    const amt = Number(r.totalAmount)
    if (daysLate <= 7) b0_7 += amt
    else if (daysLate <= 30) b8_30 += amt
    else if (daysLate <= 60) b31_60 += amt
    else b60_plus += amt
  })
  const data = {
    month,
    kpis: {
      billed,
      collected,
      outstanding,
      collectionRate,
    },
    aging: {
      "0_7": b0_7,
      "8_30": b8_30,
      "31_60": b31_60,
      "60_plus": b60_plus,
    },
  }
  return respondOk(req, data, 200)
})

