import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { ValidationError } from "@/interface/errors/ValidationError"

export const runtime = "nodejs"

export const PATCH = withErrorHandling(async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const patch: {
    enabled?: boolean
    autoApprove?: boolean
    autoExecute?: boolean
    dailyLimit?: number
    maxSeverity?: "LOW" | "MEDIUM"
  } = {}
  if ("enabled" in body) patch.enabled = Boolean(body.enabled)
  if ("autoApprove" in body) patch.autoApprove = Boolean(body.autoApprove)
  if ("autoExecute" in body) patch.autoExecute = Boolean(body.autoExecute)
  if ("dailyLimit" in body) {
    const n = Number(body.dailyLimit)
    if (!Number.isFinite(n) || n < 0) throw new ValidationError("Invalid dailyLimit")
    patch.dailyLimit = n
  }
  if ("maxSeverity" in body) {
    const s = String(body.maxSeverity)
    if (s !== "LOW" && s !== "MEDIUM") throw new ValidationError("Invalid maxSeverity")
    patch.maxSeverity = s as "LOW" | "MEDIUM"
  }
  const row = await prisma.automationPolicy.update({ where: { id }, data: patch })
  const data = {
    id: row.id,
    proposalType: row.proposalType,
    maxSeverity: row.maxSeverity,
    autoApprove: row.autoApprove,
    autoExecute: row.autoExecute,
    dailyLimit: row.dailyLimit,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
  return respondOk(req, data, 200)
})
