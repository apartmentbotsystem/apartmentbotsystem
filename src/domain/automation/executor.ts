import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { emitAuditEvent } from "@/infrastructure/audit/audit.service"
import type { z } from "zod"
import { AutomationProposalDTO } from "@/interface/validators/report.schema"

export type Proposal = z.infer<typeof AutomationProposalDTO>

export type ExecuteFeatureFlags = {
  REMIND_INVOICE: boolean
  ESCALATE_TICKET: boolean
  audit?: boolean
}

export async function executeProposal(
  proposal: Proposal,
  flags: ExecuteFeatureFlags,
): Promise<{ status: "EXECUTED" | "SKIPPED"; reason?: string; targetType: "INVOICE" | "TICKET"; targetId: string; severity?: Proposal["severity"]; currentState?: Record<string, unknown> }> {
  if (proposal.type === "REMIND_INVOICE") {
    const inv = await prisma.invoice.findUnique({ where: { id: proposal.targetId }, select: { status: true, paidAt: true, tenantId: true } })
    if (!inv) return { status: "SKIPPED", reason: "Invoice not found", targetType: "INVOICE", targetId: proposal.targetId, severity: proposal.severity }
    if (String(inv.status) !== "SENT" || inv.paidAt) {
      if (flags.audit) {
        await emitAuditEvent({
          actorType: "SYSTEM",
          action: "AUTOMATION_SKIP_INVOICE_REMINDER",
          targetType: "INVOICE",
          targetId: proposal.targetId,
          severity: "INFO",
          before: null,
          after: { status: String(inv.status), paidAt: inv.paidAt ? inv.paidAt.toISOString() : null },
        })
      }
      return {
        status: "SKIPPED",
        reason: "Already paid or not SENT",
        targetType: "INVOICE",
        targetId: proposal.targetId,
        severity: proposal.severity,
        currentState: { status: String(inv.status), paidAt: inv.paidAt ? inv.paidAt.toISOString() : null },
      }
    }
    if (!flags.REMIND_INVOICE) {
      if (flags.audit) {
        await emitAuditEvent({
          actorType: "SYSTEM",
          action: "AUTOMATION_DRY_RUN_INVOICE_REMINDER",
          targetType: "INVOICE",
          targetId: proposal.targetId,
          severity: "INFO",
          before: null,
          after: { proposed: true },
        })
      }
      return { status: "SKIPPED", reason: "Feature disabled", targetType: "INVOICE", targetId: proposal.targetId, severity: proposal.severity }
    }
    if (flags.audit) {
      await emitAuditEvent({
        actorType: "SYSTEM",
        action: "AUTOMATION_EXECUTE_INVOICE_REMINDER",
        targetType: "INVOICE",
        targetId: proposal.targetId,
        severity: "INFO",
        before: null,
        after: { proposed: true },
      })
    }
    return { status: "EXECUTED", targetType: "INVOICE", targetId: proposal.targetId, severity: proposal.severity }
  }
  if (proposal.type === "ESCALATE_TICKET") {
    const t = await prisma.ticket.findUnique({ where: { id: proposal.targetId }, select: { status: true } })
    if (!t) return { status: "SKIPPED", reason: "Ticket not found", targetType: "TICKET", targetId: proposal.targetId, severity: proposal.severity }
    if (String(t.status) === "CLOSED") {
      if (flags.audit) {
        await emitAuditEvent({
          actorType: "SYSTEM",
          action: "AUTOMATION_SKIP_TICKET_ESCALATION",
          targetType: "TICKET",
          targetId: proposal.targetId,
          severity: "INFO",
          before: null,
          after: { status: "CLOSED" },
        })
      }
      return { status: "SKIPPED", reason: "Ticket closed", targetType: "TICKET", targetId: proposal.targetId, severity: proposal.severity, currentState: { status: "CLOSED" } }
    }
    if (!flags.ESCALATE_TICKET) {
      if (flags.audit) {
        await emitAuditEvent({
          actorType: "SYSTEM",
          action: "AUTOMATION_DRY_RUN_TICKET_ESCALATION",
          targetType: "TICKET",
          targetId: proposal.targetId,
          severity: "INFO",
          before: null,
          after: { proposed: true },
        })
      }
      return { status: "SKIPPED", reason: "Feature disabled", targetType: "TICKET", targetId: proposal.targetId, severity: proposal.severity }
    }
    if (flags.audit) {
      await emitAuditEvent({
        actorType: "SYSTEM",
        action: "AUTOMATION_EXECUTE_TICKET_ESCALATION",
        targetType: "TICKET",
        targetId: proposal.targetId,
        severity: "INFO",
        before: null,
        after: { proposed: true },
      })
    }
    return { status: "EXECUTED", targetType: "TICKET", targetId: proposal.targetId, severity: proposal.severity }
  }
  return { status: "SKIPPED", reason: "Unknown proposal type", targetType: proposal.type === "REMIND_INVOICE" ? "INVOICE" : "TICKET", targetId: proposal.targetId, severity: proposal.severity }
}
