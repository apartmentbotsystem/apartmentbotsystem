import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk, respondError } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const { id } = await ctx.params
  const invoice = await prisma.invoice.findUnique({ where: { id } })
  if (!invoice) {
    return respondError(req, "INVOICE_NOT_FOUND", "Invoice not found", 404)
  }
  const events = await prisma.auditEvent.findMany({
    where: { targetType: "INVOICE", targetId: id },
    orderBy: { timestamp: "asc" },
    take: 200,
  })
  type Row = Awaited<ReturnType<typeof prisma.auditEvent.findMany>>[number]
  const items: Array<{ action: string; timestamp: string; actor: "ADMIN" | "SYSTEM"; metadata: Record<string, unknown> }> = []
  items.push({
    action: "CREATED",
    timestamp: invoice.issuedAt.toISOString(),
    actor: "SYSTEM",
    metadata: { periodMonth: invoice.periodMonth },
  })
  for (const e of events) {
    const actor = e.actorType === "ADMIN" || e.actorType === "STAFF" ? "ADMIN" : "SYSTEM"
    const meta: Record<string, unknown> = { ...(e.metadata ?? {}), periodMonth: invoice.periodMonth }
    if (e.action === "INVOICE_PAID" && invoice.paymentNote) {
      meta.paymentNote = invoice.paymentNote
    }
    items.push({
      action: e.action,
      timestamp: (e as Row).timestamp.toISOString(),
      actor,
      metadata: meta,
    })
  }
  return respondOk(req, { items }, 200)
})
