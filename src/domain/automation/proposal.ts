import type { z } from "zod"
import { AutomationProposalDTO, OverdueInvoicesCandidatesDTO, TicketsNoReplyCandidatesDTO } from "@/interface/validators/report.schema"

export type OverdueItem = z.infer<typeof OverdueInvoicesCandidatesDTO>["items"][number]
export type NoReplyItem = z.infer<typeof TicketsNoReplyCandidatesDTO>["items"][number]
export type Proposal = z.infer<typeof AutomationProposalDTO>

function severityFromDays(days: number): "LOW" | "MEDIUM" | "HIGH" {
  if (days >= 8) return "HIGH"
  if (days >= 4) return "MEDIUM"
  return "LOW"
}

function stableId(parts: Array<string | number>): string {
  return parts.map((p) => String(p)).join("|")
}

export function makeInvoiceReminderProposals(items: OverdueItem[], minOverdueDays: number): Proposal[] {
  const proposals: Proposal[] = []
  for (const it of items) {
    if (it.overdueDays < minOverdueDays) continue
    const sev = severityFromDays(it.overdueDays)
    const id = stableId(["REMIND_INVOICE", "OVERDUE_INVOICE", it.invoiceId, it.overdueDays])
    const reason = `Invoice ${it.invoiceId} overdue ${it.overdueDays} days without payment confirmation`
    proposals.push({
      id,
      type: "REMIND_INVOICE",
      source: "OVERDUE_INVOICE",
      targetId: it.invoiceId,
      recommendedAction: "Send overdue reminder to tenant",
      reason,
      severity: sev,
      generatedAt: new Date(0).toISOString(),
    })
  }
  return proposals
}

export function makeTicketEscalationProposals(items: NoReplyItem[], thresholdDays: number): Proposal[] {
  const proposals: Proposal[] = []
  for (const it of items) {
    if (it.daysOpen <= thresholdDays) continue
    const sev = severityFromDays(it.daysOpen)
    const id = stableId(["ESCALATE_TICKET", "NO_REPLY_TICKET", it.ticketId, it.daysOpen])
    const reason = `Ticket ${it.ticketId} no tenant response for ${it.daysOpen} days`
    proposals.push({
      id,
      type: "ESCALATE_TICKET",
      source: "NO_REPLY_TICKET",
      targetId: it.ticketId,
      recommendedAction: "Escalate ticket to admin for follow-up",
      reason,
      severity: sev,
      generatedAt: new Date(0).toISOString(),
    })
  }
  return proposals
}

export function generateProposals(input: {
  overdue: OverdueItem[]
  noReply: NoReplyItem[]
  minOverdueDays: number
  thresholdDays: number
}): Proposal[] {
  const a = makeInvoiceReminderProposals(input.overdue, input.minOverdueDays)
  const b = makeTicketEscalationProposals(input.noReply, input.thresholdDays)
  return [...a, ...b]
}
