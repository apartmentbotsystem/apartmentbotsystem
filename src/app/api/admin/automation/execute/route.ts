import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { executeProposal } from "@/domain/automation/executor"
import { ValidationError } from "@/interface/errors/ValidationError"

export const runtime = "nodejs"

export const POST = withErrorHandling(async (req: Request): Promise<Response> => {
  const session = await requireRole(req, ["ADMIN"])
  const body = await req.json().catch(() => ({}))
  const approvalId = typeof body?.approvalId === "string" ? body.approvalId : ""
  const dryRun = Boolean(body?.dryRun)
  if (!approvalId) {
    throw new ValidationError("Invalid approvalId")
  }
  const approval = await prisma.automationApproval.findUnique({ where: { id: approvalId } })
  if (!approval) {
    throw new ValidationError("Approval not found")
  }
  if (String(approval.decision) !== "APPROVED") {
    throw new ValidationError("Approval is not APPROVED")
  }
  if (approval.executedAt) {
    return respondOk(req, { status: "SKIPPED", reason: "Already executed" }, 200)
  }
  const proposal = approval.proposalSnapshot as unknown as Parameters<typeof executeProposal>[0]
  const flags = {
    REMIND_INVOICE: !dryRun,
    ESCALATE_TICKET: !dryRun,
    audit: !dryRun,
  }
  const result = await executeProposal(proposal, flags)
  if (!dryRun) {
    await prisma.automationApproval.update({
      where: { id: approvalId },
      data: {
        executedAt: new Date(),
        executeResult: result as unknown as object,
      },
    })
    const action = result.status === "EXECUTED" ? "EXECUTE" : result.status === "SKIPPED" ? "SKIP" : "FAIL"
    await prisma.automationAudit.create({
      data: {
        approvalId,
        proposalId: (proposal as { id: string }).id,
        action,
        actorId: session.userId || "",
        dryRun: false,
        result: result as unknown as object,
      },
    })
  }
  return respondOk(req, result, 200)
})
