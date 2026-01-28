import type { z } from "zod"
import { AutomationProposalDTO } from "@/interface/validators/report.schema"

export type Proposal = z.infer<typeof AutomationProposalDTO>

export type AutomationPolicy = {
  id: string
  proposalType: "REMIND_INVOICE" | "ESCALATE_TICKET"
  maxSeverity: "LOW" | "MEDIUM"
  autoApprove: boolean
  autoExecute: boolean
  dailyLimit: number
  enabled: boolean
}

export function evaluatePolicy(proposal: Proposal, policy: AutomationPolicy): {
  canAutoApprove: boolean
  canAutoExecute: boolean
  reason: string
} {
  if (!policy.enabled) return { canAutoApprove: false, canAutoExecute: false, reason: "POLICY_DISABLED" }
  if (proposal.type !== policy.proposalType) return { canAutoApprove: false, canAutoExecute: false, reason: "TYPE_MISMATCH" }
  if (proposal.severity === "HIGH" || proposal.severity === "CRITICAL") {
    return { canAutoApprove: false, canAutoExecute: false, reason: "HIGH_OR_CRITICAL_SEVERITY_FORBIDDEN" }
  }
  const sevOrder = (s: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") => (s === "LOW" ? 0 : s === "MEDIUM" ? 1 : s === "HIGH" ? 2 : 3)
  if (sevOrder(proposal.severity) > sevOrder(policy.maxSeverity)) {
    return { canAutoApprove: false, canAutoExecute: false, reason: "SEVERITY_OVER_POLICY_MAX" }
  }
  const canAutoApprove = policy.autoApprove
  const canAutoExecute = policy.autoExecute && canAutoApprove
  return { canAutoApprove, canAutoExecute, reason: "OK" }
}
