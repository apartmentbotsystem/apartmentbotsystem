import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { OverdueInvoicesCandidatesDTO } from "@/interface/validators/report.schema"

export const runtime = "nodejs"

function daysBetweenUTC(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  const diffMs = b - a
  return Math.max(0, Math.floor(diffMs / 86_400_000))
}

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN", "STAFF"])
  const url = new URL(req.url)
  const period = url.searchParams.get("period") || undefined
  const today = new Date()
  const where: Record<string, unknown> = { status: "SENT", paidAt: null }
  if (period) where["periodMonth"] = period
  const rows = await prisma.invoice.findMany({
    where,
    select: { id: true, tenantId: true, roomId: true, periodMonth: true, dueDate: true },
    orderBy: { dueDate: "asc" },
    take: 500,
  })
  type Row = Awaited<ReturnType<typeof prisma.invoice.findMany>>[number]
  const items = rows
    .map((r: Row) => {
      const overdueDays = daysBetweenUTC(r.dueDate, today)
      return {
        invoiceId: r.id,
        tenantId: r.tenantId,
        roomId: r.roomId,
        periodMonth: r.periodMonth,
        overdueDays,
      }
    })
    .filter((it) => it.overdueDays > 0)
  const payload = { items }
  OverdueInvoicesCandidatesDTO.parse(payload)
  return respondOk(req, payload, 200)
})
