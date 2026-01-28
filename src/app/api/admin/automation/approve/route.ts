import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { AutomationApprovalRequestDTO } from "@/interface/validators/report.schema"
import { ValidationError } from "@/interface/errors/ValidationError"
import crypto from "node:crypto"

export const runtime = "nodejs"

export const POST = withErrorHandling(async (req: Request): Promise<Response> => {
  const session = await requireRole(req, ["ADMIN"])
  const body = await req.json().catch(() => ({}))
  const parsed = AutomationApprovalRequestDTO.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError("Invalid approval payload")
  }
  const snapshot = parsed.data.proposal
  const hash = crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex")
  const existing = await prisma.automationApproval.findUnique({ where: { proposalId: snapshot.id } })
  if (existing) {
    throw new ValidationError("Proposal already decided")
  }
  const row = await prisma.automationApproval.create({
    data: {
      proposalId: snapshot.id,
      decision: parsed.data.decision,
      decidedBy: session.userId || "",
      note: parsed.data.note ?? null,
      proposalSnapshot: snapshot as unknown as object,
      proposalHash: hash,
    },
  })
  const payload = {
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
  }
  return respondOk(req, payload, 201)
})
