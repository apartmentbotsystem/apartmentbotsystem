import { z } from "zod"

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

export const MonthlyInvoiceSummaryDTO = z.object({
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/),
  totals: z.object({
    issued: z.number().int().nonnegative(),
    sent: z.number().int().nonnegative(),
    paid: z.number().int().nonnegative(),
    unpaid: z.number().int().nonnegative(),
  }),
  amounts: z.object({
    paidTotal: z.number().nonnegative(),
    unpaidTotal: z.number().nonnegative(),
  }),
})

export const PaymentLatencyStatsDTO = z.object({
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/),
  latencyDays: z.object({
    avg: z.number().nonnegative(),
    median: z.number().nonnegative(),
    p95: z.number().nonnegative(),
  }),
})

export const InvoiceConversionSummaryDTO = z.object({
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/),
  issuedCount: z.number().int().nonnegative(),
  paidCount: z.number().int().nonnegative(),
  conversionRate: z.number().min(0).max(1),
  unpaidAgingBuckets: z.object({
    d0_7: z.number().int().nonnegative(),
    d8_14: z.number().int().nonnegative(),
    d15_30: z.number().int().nonnegative(),
    d31_plus: z.number().int().nonnegative(),
  }),
})

export const PaymentLatencyTrendDTO = z.object({
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/),
  avgLatency: z.number().nonnegative(),
  medianLatency: z.number().nonnegative(),
  p95Latency: z.number().nonnegative(),
  trendDirection: z.enum(["UP", "DOWN", "FLAT"]),
})

export const OverdueInvoicesCandidatesDTO = z.object({
  items: z.array(
    z.object({
      invoiceId: z.string(),
      tenantId: z.string(),
      roomId: z.string(),
      periodMonth: z.string().regex(/^\d{4}-\d{2}$/),
      overdueDays: z.number().int().nonnegative(),
    }),
  ),
})

export const TicketsNoReplyCandidatesDTO = z.object({
  items: z.array(
    z.object({
      ticketId: z.string(),
      daysOpen: z.number().int().nonnegative(),
      lastReplyAt: z.string().datetime().optional(),
    }),
  ),
})

export const UnpaidSentInvoicesOlderThanDTO = z.object({
  items: z.array(
    z.object({
      invoiceId: z.string(),
      daysSinceSent: z.number().int().nonnegative(),
    }),
  ),
})

export const AutomationProposalDTO = z.object({
  id: z.string(),
  type: z.enum(["REMIND_INVOICE", "ESCALATE_TICKET"]),
  source: z.enum(["OVERDUE_INVOICE", "NO_REPLY_TICKET", "REPEATED_REMINDER"]),
  targetId: z.string(),
  recommendedAction: z.string(),
  reason: z.string(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  generatedAt: z.string().datetime(),
})

export const AutomationDryRunResponseDTO = z.object({
  proposals: z.array(AutomationProposalDTO),
})

export const AutomationApprovalDecisionDTO = z.enum(["APPROVED", "REJECTED"])

export const AutomationApprovalRequestDTO = z.object({
  proposal: AutomationProposalDTO,
  decision: AutomationApprovalDecisionDTO,
  note: z.string().max(500).optional(),
})

export const AutomationApprovalDTO = z.object({
  id: z.string(),
  proposalId: z.string(),
  decision: AutomationApprovalDecisionDTO,
  decidedBy: z.string(),
  decidedAt: z.string(),
  note: z.string().optional().nullable(),
  proposalSnapshot: z.any(),
  proposalHash: z.string(),
  executedAt: z.string().optional().nullable(),
  executeResult: z.any().optional().nullable(),
})

export const AutomationApprovalsListDTO = z.object({
  items: z.array(AutomationApprovalDTO),
})
