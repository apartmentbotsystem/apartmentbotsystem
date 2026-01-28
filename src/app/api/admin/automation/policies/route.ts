import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const rows = await prisma.automationPolicy.findMany({ orderBy: { proposalType: "asc" } })
  type Row = Awaited<ReturnType<typeof prisma.automationPolicy.findMany>>[number]
  const data = rows.map((r: Row) => ({
    id: r.id,
    proposalType: r.proposalType,
    maxSeverity: r.maxSeverity,
    autoApprove: r.autoApprove,
    autoExecute: r.autoExecute,
    dailyLimit: r.dailyLimit,
    enabled: r.enabled,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }))
  return respondOk(req, { items: data }, 200)
})
