import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk, respondError } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"

type BucketKey = "d0_7" | "d8_30" | "d31_plus"
type AgingDrilldownItemDTO = {
  id: string
  roomId: string | null
  tenantId: string | null
  totalAmount: number
  dueDate: string
  overdueDays: number
}
type AgingDrilldownDTO = {
  periodMonth: string
  bucket: BucketKey
  items: ReadonlyArray<AgingDrilldownItemDTO>
}

function isValidMonth(s: string): boolean {
  return /^\d{4}-\d{2}$/.test(s)
}
function daysBetweenUTC(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime()
  return Math.floor(ms / (24 * 60 * 60 * 1000))
}

export const GET = withErrorHandling(async (req: Request, ctx: { params: Promise<{ bucket: string }> }): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const { bucket } = await ctx.params
  const key = String(bucket) as BucketKey
  if (key !== "d0_7" && key !== "d8_30" && key !== "d31_plus") {
    return respondError(req, "VALIDATION_ERROR", "Invalid bucket key", 400)
  }
  const url = new URL(req.url)
  const monthParam = url.searchParams.get("month")
  if (!monthParam || !isValidMonth(monthParam)) {
    return respondError(req, "VALIDATION_ERROR", "Invalid month format (expected YYYY-MM)", 400)
  }
  const month = monthParam
  const now = new Date()
  const invoices = await prisma.invoice.findMany({
    where: { periodMonth: month },
    select: { id: true, roomId: true, tenantId: true, status: true, dueDate: true, totalAmount: true, paidAt: true },
    orderBy: { issuedAt: "asc" },
    take: 5000,
  })
  const items: AgingDrilldownItemDTO[] = []
  for (const inv of invoices) {
    const status = String(inv.status)
    const unpaid = status === "SENT" && !(inv.paidAt instanceof Date)
    if (!unpaid) continue
    if (!(inv.dueDate instanceof Date)) continue
    if (now < inv.dueDate) continue
    const overdueDays = daysBetweenUTC(now, inv.dueDate)
    let b: BucketKey
    if (overdueDays <= 7) b = "d0_7"
    else if (overdueDays <= 30) b = "d8_30"
    else b = "d31_plus"
    if (b !== key) continue
    items.push({
      id: String(inv.id),
      roomId: inv.roomId ?? null,
      tenantId: inv.tenantId ?? null,
      totalAmount: Number(inv.totalAmount || 0),
      dueDate: inv.dueDate.toISOString(),
      overdueDays,
    })
  }
  const payload: AgingDrilldownDTO = { periodMonth: month, bucket: key, items }
  return respondOk<AgingDrilldownDTO>(req, payload, 200)
})
