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
  const row = await prisma.automationApproval.findUnique({ where: { id } })
  if (!row) {
    throw new ValidationError("Approval not found")
  }
  const proposal = row.proposalSnapshot as unknown as Parameters<typeof executeProposal>[0]
  const flags = {
    REMIND_INVOICE: false,
    ESCALATE_TICKET: false,
    audit: false,
  }
  const result = await executeProposal(proposal, flags)
  return respondOk(req, result, 200)
})
