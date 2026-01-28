import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const url = new URL(req.url)
  const proposalId = url.searchParams.get("proposalId") || undefined
  const approvalId = url.searchParams.get("approvalId") || undefined
  const action = url.searchParams.get("action") || undefined
  const period = url.searchParams.get("period") || undefined
  const limitStr = url.searchParams.get("limit") || "200"
  const limitNum = Number(limitStr)
  const take = Number.isFinite(limitNum) && limitNum > 0 ? Math.min(limitNum, 500) : 200

  const where: Record<string, unknown> = {}
  if (proposalId) where["proposalId"] = proposalId
  if (approvalId) where["approvalId"] = approvalId
  if (action) where["action"] = action
  if (period && /^\d{4}-\d{2}$/.test(period)) {
    const [yStr, mStr] = period.split("-")
    const y = Number(yStr)
    const m = Number(mStr)
    const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0))
    const end = new Date(Date.UTC(y, m, 1, 0, 0, 0))
    where["createdAt"] = { gte: start, lt: end }
  }

  const rows = await prisma.automationAudit.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
  })
  type Row = Awaited<ReturnType<typeof prisma.automationAudit.findMany>>[number]
  const data = rows.map((r: Row) => ({
    id: r.id,
    approvalId: r.approvalId,
    proposalId: r.proposalId,
    action: r.action,
    actorId: r.actorId,
    dryRun: r.dryRun,
    result: (r.result as unknown as Record<string, unknown>) ?? null,
    createdAt: r.createdAt.toISOString(),
  }))
  return respondOk(req, { items: data }, 200)
})
