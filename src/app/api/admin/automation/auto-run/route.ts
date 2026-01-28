import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { AutomationDryRunResponseDTO, OverdueInvoicesCandidatesDTO, TicketsNoReplyCandidatesDTO } from "@/interface/validators/report.schema"
import { generateProposals } from "@/domain/automation/proposal"
import { evaluatePolicy } from "@/domain/automation/policy"
import crypto from "node:crypto"

export const runtime = "nodejs"

async function fetchEnvelope<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/vnd.apartment.v1.1+json" }, cache: "no-store" })
  const json = await res.json()
  if (json && typeof json === "object" && "success" in json) {
    if (json.success) return json.data as T
    const msg = (json.error && json.error.message) || "Error"
    throw new Error(String(msg))
  }
  return json as T
}

export const POST = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  if (String(process.env.AUTOMATION_AUTORUN_ENABLED || "false") !== "true") {
    return respondOk(req, { status: "SKIPPED", reason: "KILL_SWITCH_OFF" }, 200)
  }
  const url = new URL(req.url)
  const period = url.searchParams.get("period") || ""
  const minOverdueDays = Number(url.searchParams.get("minOverdueDays") || "4")
  const thresholdDays = Number(url.searchParams.get("thresholdDays") || "3")
  const qs1 = period ? `?period=${encodeURIComponent(period)}` : ""
  const qs2 = `?thresholdDays=${encodeURIComponent(thresholdDays)}`
  const overdueData = await fetchEnvelope<{ items: unknown }>(`/api/admin/automation-candidates/invoices/overdue${qs1}`)
  const noReplyData = await fetchEnvelope<{ items: unknown }>(`/api/admin/automation-candidates/tickets/no-reply${qs2}`)
  const overdueParsed = OverdueInvoicesCandidatesDTO.parse(overdueData)
  const noReplyParsed = TicketsNoReplyCandidatesDTO.parse(noReplyData)
  const proposals = generateProposals({
    overdue: overdueParsed.items,
    noReply: noReplyParsed.items,
    minOverdueDays,
    thresholdDays,
  })
  AutomationDryRunResponseDTO.parse({ proposals })
  const policies = await prisma.automationPolicy.findMany({ where: { enabled: true } })
  type PolicyRow = Awaited<ReturnType<typeof prisma.automationPolicy.findMany>>[number]
  const policyByType = new Map<string, PolicyRow>()
  for (const p of policies) policyByType.set(String(p.proposalType), p)

  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setUTCHours(23, 59, 59, 999)

  const results: Array<{ proposalId: string; decision: "AUTO_APPROVED" | "SKIPPED"; executed?: "AUTO_EXECUTED" | "SKIPPED"; reason?: string }> = []
  for (const proposal of proposals) {
    const policy = policyByType.get(proposal.type)
    if (!policy) {
      results.push({ proposalId: proposal.id, decision: "SKIPPED", reason: "NO_POLICY" })
      continue
    }
    const evalr = evaluatePolicy(proposal as unknown as Parameters<typeof evaluatePolicy>[0], {
      id: policy.id,
      proposalType: policy.proposalType as unknown as "REMIND_INVOICE" | "ESCALATE_TICKET",
      maxSeverity: policy.maxSeverity as unknown as "LOW" | "MEDIUM",
      autoApprove: policy.autoApprove,
      autoExecute: policy.autoExecute,
      dailyLimit: policy.dailyLimit,
      enabled: policy.enabled,
    })
    if (!evalr.canAutoApprove) {
      results.push({ proposalId: proposal.id, decision: "SKIPPED", reason: evalr.reason })
      continue
    }
    const existing = await prisma.automationApproval.findUnique({ where: { proposalId: proposal.id } })
    if (!existing) {
      const hash = crypto.createHash("sha256").update(JSON.stringify(proposal)).digest("hex")
      const row = await prisma.automationApproval.create({
        data: {
          proposalId: proposal.id,
          decision: "APPROVED",
          decidedBy: "SYSTEM",
          note: null,
          proposalSnapshot: proposal as unknown as object,
          proposalHash: hash,
        },
      })
      await prisma.automationAudit.create({
        data: {
          approvalId: row.id,
          proposalId: row.proposalId,
          action: "AUTO_APPROVED",
          actorId: "SYSTEM",
          dryRun: false,
          result: { status: "APPROVED" } as unknown as object,
        },
      })
    }
    results.push({ proposalId: proposal.id, decision: "AUTO_APPROVED" })
    if (!evalr.canAutoExecute) {
      results[results.length - 1].executed = "SKIPPED"
      continue
    }
    const executedToday = await prisma.automationAudit.count({
      where: { action: "AUTO_EXECUTED", createdAt: { gte: todayStart, lte: todayEnd } },
    })
    if (executedToday >= policy.dailyLimit) {
      const appr = await prisma.automationApproval.findUnique({ where: { proposalId: proposal.id } })
      if (appr) {
        await prisma.automationAudit.create({
          data: {
            approvalId: appr.id,
            proposalId: proposal.id,
            action: "FAIL",
            actorId: "SYSTEM",
            dryRun: false,
            result: { reason: "DAILY_LIMIT_EXCEEDED" } as unknown as object,
          },
        })
      }
      results[results.length - 1].executed = "SKIPPED"
      continue
    }
    const appr = await prisma.automationApproval.findUnique({ where: { proposalId: proposal.id } })
    if (!appr) continue
    const { executeProposal } = await import("@/domain/automation/executor")
    const flags = {
      REMIND_INVOICE: proposal.type === "REMIND_INVOICE",
      ESCALATE_TICKET: proposal.type === "ESCALATE_TICKET",
      audit: false,
    }
    const result = await executeProposal(proposal as unknown as Parameters<typeof executeProposal>[0], flags)
    await prisma.automationApproval.update({
      where: { id: appr.id },
      data: {
        executedAt: new Date(),
        executeResult: result as unknown as object,
      },
    })
    await prisma.automationAudit.create({
      data: {
        approvalId: appr.id,
        proposalId: proposal.id,
        action: "AUTO_EXECUTED",
        actorId: "SYSTEM",
        dryRun: false,
        result: result as unknown as object,
      },
    })
    results[results.length - 1].executed = "AUTO_EXECUTED"
  }
  return respondOk(req, { results }, 200)
})
