import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { executeProposal } from "@/domain/automation/executor"
import { ValidationError } from "@/interface/errors/ValidationError"

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const { id } = await ctx.params
  const approval = await prisma.automationApproval.findUnique({ where: { id } })
  if (!approval) {
    throw new ValidationError("Approval not found")
  }
  const proposal = approval.proposalSnapshot as unknown as Parameters<typeof executeProposal>[0]
  const previewFlags = { REMIND_INVOICE: false, ESCALATE_TICKET: false, audit: false }
  const preview = await executeProposal(proposal, previewFlags)
  const audits = await prisma.automationAudit.findMany({
    where: { approvalId: id },
    orderBy: { createdAt: "asc" },
    take: 500,
  })
  type AuditRow = Awaited<ReturnType<typeof prisma.automationAudit.findMany>>[number]
  const timeline = [
    {
      type: "APPROVED",
      timestamp: approval.decidedAt.toISOString(),
      actorId: approval.decidedBy,
      dryRun: true,
      payload: approval.proposalSnapshot as unknown as Record<string, unknown>,
    },
    {
      type: "PREVIEW",
      timestamp: new Date().toISOString(),
      actorId: approval.decidedBy,
      dryRun: true,
      payload: preview as unknown as Record<string, unknown>,
    },
    ...(audits.map((a: AuditRow) => ({
      type: a.action,
      timestamp: a.createdAt.toISOString(),
      actorId: a.actorId,
      dryRun: a.dryRun,
      payload: (a.result as unknown as Record<string, unknown>) ?? null,
    })) as Array<{ type: string; timestamp: string; actorId: string; dryRun: boolean; payload: Record<string, unknown> | null }>),
  ]
  const payload = {
    approval: {
      id: approval.id,
      proposalId: approval.proposalId,
      decision: approval.decision,
      decidedBy: approval.decidedBy,
      decidedAt: approval.decidedAt.toISOString(),
      executedAt: approval.executedAt ? approval.executedAt.toISOString() : null,
      executeResult: (approval.executeResult as unknown as Record<string, unknown> | null) ?? null,
    },
    preview,
    audits: audits.map((a: AuditRow) => ({
      id: a.id,
      action: a.action,
      actorId: a.actorId,
      dryRun: a.dryRun,
      result: (a.result as unknown as Record<string, unknown>) ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
    timeline,
  }
  return respondOk(req, payload, 200)
})
