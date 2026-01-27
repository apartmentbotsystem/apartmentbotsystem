import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"

export const runtime = "nodejs"

function parseGraceDays(): number {
  const v = Number(process.env.INVOICE_GRACE_DAYS)
  if (!Number.isFinite(v) || v <= 0) return 5
  return Math.floor(v)
}

function calculateDueDate(periodMonth: string): Date {
  const [y, m] = String(periodMonth).split("-").map((s) => Number(s))
  const end = new Date(Date.UTC(y, m, 0))
  const grace = parseGraceDays()
  return new Date(end.getTime() + grace * 24 * 60 * 60 * 1000)
}

export const GET = withErrorHandling(async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const { id } = await ctx.params
  const rows = await prisma.auditEvent.findMany({
    where: {
      action: "INVOICE_REMINDER_SENT",
      metadata: { path: ["invoiceId"], equals: id },
    },
    orderBy: { timestamp: "desc" },
    take: 50,
  })
  type Row = Awaited<ReturnType<typeof prisma.auditEvent.findMany>>[number]
  const items = rows.map((r: Row) => {
    const m = (r.metadata ?? {}) as Record<string, unknown>
    const periodMonth = String(m["periodMonth"] || "")
    const due = periodMonth ? calculateDueDate(periodMonth) : null
    const overdueDays =
      due ? Math.max(0, Math.floor((r.timestamp.getTime() - due.getTime()) / (24 * 60 * 60 * 1000))) : Number(m["overdueDays"] || 0)
    return {
      id: r.id,
      sentAt: r.timestamp.toISOString(),
      overdueDays,
      sentBy: { id: r.actorId ?? "", name: "Admin" },
    }
  })
  return respondOk(req, { items }, 200)
})

