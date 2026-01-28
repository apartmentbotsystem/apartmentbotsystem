import { describe, it, expect } from "vitest"
import { makeInvoiceReminderProposals, makeTicketEscalationProposals, generateProposals } from "@/domain/automation/proposal"

describe("Automation Proposal Generation (Domain)", () => {
  it("deterministic: same input -> same output", () => {
    const overdue = [{ invoiceId: "inv-1", tenantId: "ten-1", roomId: "room-1", periodMonth: "2026-01", overdueDays: 6 }]
    const noReply = [{ ticketId: "t1", daysOpen: 5, lastReplyAt: undefined }]
    const a = generateProposals({ overdue, noReply, minOverdueDays: 4, thresholdDays: 3 })
    const b = generateProposals({ overdue, noReply, minOverdueDays: 4, thresholdDays: 3 })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it("severity mapping correctness (invoices)", () => {
    const res = makeInvoiceReminderProposals(
      [
        { invoiceId: "inv-low", tenantId: "ten", roomId: "room", periodMonth: "2026-01", overdueDays: 2 },
        { invoiceId: "inv-med", tenantId: "ten", roomId: "room", periodMonth: "2026-01", overdueDays: 4 },
        { invoiceId: "inv-high", tenantId: "ten", roomId: "room", periodMonth: "2026-01", overdueDays: 9 },
      ],
      1,
    )
    const byId = Object.fromEntries(res.map((p) => [p.targetId, p.severity]))
    expect(byId["inv-low"]).toBe("LOW")
    expect(byId["inv-med"]).toBe("MEDIUM")
    expect(byId["inv-high"]).toBe("HIGH")
  })

  it("reason string correctness (invoices)", () => {
    const res = makeInvoiceReminderProposals(
      [{ invoiceId: "INV-2026-01", tenantId: "ten", roomId: "room", periodMonth: "2026-01", overdueDays: 6 }],
      1,
    )
    expect(res[0].reason).toBe("Invoice INV-2026-01 overdue 6 days without payment confirmation")
  })

  it("severity mapping correctness (tickets)", () => {
    const res = makeTicketEscalationProposals(
      [
        { ticketId: "t-low", daysOpen: 2, lastReplyAt: undefined },
        { ticketId: "t-med", daysOpen: 5, lastReplyAt: undefined },
        { ticketId: "t-high", daysOpen: 9, lastReplyAt: undefined },
      ],
      1,
    )
    const byId = Object.fromEntries(res.map((p) => [p.targetId, p.severity]))
    expect(byId["t-low"]).toBe("LOW")
    expect(byId["t-med"]).toBe("MEDIUM")
    expect(byId["t-high"]).toBe("HIGH")
  })

  it("reason string correctness (tickets)", () => {
    const res = makeTicketEscalationProposals([{ ticketId: "TCK-129", daysOpen: 5, lastReplyAt: undefined }], 1)
    expect(res[0].reason).toBe("Ticket TCK-129 no tenant response for 5 days")
  })
})
