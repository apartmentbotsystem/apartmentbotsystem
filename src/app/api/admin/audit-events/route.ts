import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { requireRole } from "@/lib/guards"

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const url = new URL(req.url)
  const limitNum = Number(url.searchParams.get("limit") || "50")
  const take = Number.isFinite(limitNum) && limitNum > 0 ? Math.min(limitNum, 200) : 50
  const actorType = url.searchParams.get("actorType") || undefined
  const targetType = url.searchParams.get("targetType") || undefined
  const targetId = url.searchParams.get("targetId") || undefined
  const fromStr = url.searchParams.get("from") || undefined
  const toStr = url.searchParams.get("to") || undefined
  const where: Record<string, unknown> = {}
  if (actorType) where["actorType"] = actorType
  if (targetType) where["targetType"] = targetType
  if (targetId) where["targetId"] = targetId
  if (fromStr || toStr) {
    const range: Record<string, Date> = {}
    if (fromStr) {
      const d = new Date(fromStr)
      if (!Number.isNaN(d.getTime())) range["gte"] = d
    }
    if (toStr) {
      const d = new Date(toStr)
      if (!Number.isNaN(d.getTime())) range["lte"] = d
    }
    if (Object.keys(range).length > 0) where["timestamp"] = range
  }
  const rows = await prisma.auditEvent.findMany({
    where,
    orderBy: { timestamp: "desc" },
    take,
  })
  type AuditEventRow = Awaited<ReturnType<typeof prisma.auditEvent.findMany>>[number]
  const data = rows.map((r: AuditEventRow) => ({
    id: r.id,
    timestamp: r.timestamp.toISOString(),
    actorType: r.actorType,
    actorId: r.actorId ?? null,
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId ?? null,
    severity: r.severity,
    metadata: r.metadata ?? null,
  }))
  return respondOk(req, data, 200)
})
