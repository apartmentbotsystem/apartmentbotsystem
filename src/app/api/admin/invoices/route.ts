import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { ValidationError } from "@/interface/errors/ValidationError"
import { isInvoiceOverdue } from "@/domain/invoice/isInvoiceOverdue"

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const url = new URL(req.url)
  const period = url.searchParams.get("period")
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    throw new ValidationError("Invalid period format, expected YYYY-MM")
  }
  const rows = await prisma.invoice.findMany({
    where: { periodMonth: period },
    include: { tenant: true, room: true },
    orderBy: [{ room: { roomNumber: "asc" } }],
    take: 1000,
  })
  type Row = Awaited<ReturnType<typeof prisma.invoice.findMany>>[number]
  const parts = period.split("-")
  const year = Number(parts[0])
  const month = Number(parts[1])
  const end = new Date(Date.UTC(year, month, 0))
  const grace = Number(process.env.INVOICE_GRACE_DAYS) && Number(process.env.INVOICE_GRACE_DAYS) > 0 ? Math.floor(Number(process.env.INVOICE_GRACE_DAYS)) : 5
  const dueDate = new Date(end.getTime() + grace * 24 * 60 * 60 * 1000)
  const data = rows.map((r: Row) => ({
    id: r.id,
    tenant: { id: r.tenant.id, name: r.tenant.name },
    room: { id: r.room.id, roomNumber: r.room.roomNumber },
    period: r.periodMonth,
    rent: r.rentAmount,
    total: r.totalAmount,
    status: r.status,
    isOverdue: isInvoiceOverdue({ status: r.status as "DRAFT" | "SENT" | "PAID" | "CANCELLED", paidAt: r.paidAt, periodMonth: r.periodMonth }),
    dueDate: dueDate.toISOString(),
  }))
  return respondOk(req, data, 200)
})
