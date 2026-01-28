import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { AutomationApprovalsListDTO } from "@/interface/validators/report.schema"

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const rows = await prisma.automationApproval.findMany({
    orderBy: { decidedAt: "desc" },
    take: 200,
  })
  const items = rows.map((row) => ({
    id: row.id,
    proposalId: row.proposalId,
    decision: row.decision,
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt.toISOString(),
    note: row.note ?? null,
    proposalSnapshot: row.proposalSnapshot as unknown as Record<string, unknown>,
    proposalHash: row.proposalHash,
    executedAt: row.executedAt ? row.executedAt.toISOString() : null,
    executeResult: (row.executeResult as unknown as Record<string, unknown> | null) ?? null,
  }))
  const payload = { items }
  AutomationApprovalsListDTO.parse(payload)
  return respondOk(req, payload, 200)
})
