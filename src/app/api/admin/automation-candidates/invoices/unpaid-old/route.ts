import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { UnpaidSentInvoicesOlderThanDTO } from "@/interface/validators/report.schema"

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
  const minDays = Number(url.searchParams.get("minDays") || "7")
  const period = url.searchParams.get("period") || undefined
  const today = new Date()
  const where: Record<string, unknown> = { status: "SENT", paidAt: null }
  if (period) where["periodMonth"] = period
  const rows = await prisma.invoice.findMany({
    where,
    select: { id: true, sentAt: true },
    orderBy: { sentAt: "asc" },
    take: 500,
  })
  type Row = Awaited<ReturnType<typeof prisma.invoice.findMany>>[number]
  const items = rows
    .map((r: Row) => {
      const sentAt = r.sentAt ?? new Date(0)
      const daysSinceSent = daysBetweenUTC(sentAt, today)
      return { invoiceId: r.id, daysSinceSent }
    })
    .filter((it) => it.daysSinceSent >= minDays)
  const payload = { items }
  UnpaidSentInvoicesOlderThanDTO.parse(payload)
  return respondOk(req, payload, 200)
})
