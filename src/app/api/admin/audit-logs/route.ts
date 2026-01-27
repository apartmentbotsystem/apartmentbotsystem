import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { requireRole } from "@/lib/guards"

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const url = new URL(req.url)
  const action = url.searchParams.get("action") || undefined
  const tenantId = url.searchParams.get("tenantId") || undefined
  const adminId = url.searchParams.get("adminId") || undefined
  const limitStr = url.searchParams.get("limit") || "50"
  const limitNum = Number(limitStr)
  const take = Number.isFinite(limitNum) && limitNum > 0 ? Math.min(limitNum, 200) : 50
  const where: Record<string, unknown> = {}
  if (action) where["action"] = action
  if (tenantId) where["tenantId"] = tenantId
  if (adminId) where["adminId"] = adminId
  const rows = await prisma.adminAuditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
  })
  type Row = Awaited<ReturnType<typeof prisma.adminAuditLog.findMany>>[number]
  const data = rows.map((r: Row) => ({
    id: r.id,
    action: r.action,
    adminId: r.adminId,
    tenantRegistrationId: r.tenantRegistrationId,
    tenantId: r.tenantId ?? null,
    lineUserId: r.lineUserId ?? null,
    createdAt: r.createdAt.toISOString(),
  }))
  return respondOk(req, data, 200)
})
