import { describe, it, expect, beforeEach } from "vitest"
import { isInvoiceOverdue } from "@/domain/invoice/isInvoiceOverdue"

describe("invoice overdue helper", () => {
  beforeEach(() => {
    delete (process.env as Record<string, string>)["INVOICE_GRACE_DAYS"]
  })

  it("SENT + past dueDate -> true", () => {
    const now = new Date(Date.UTC(2026, 1, 10))
    const inv = { status: "SENT" as const, paidAt: null, periodMonth: "2026-01" }
    expect(isInvoiceOverdue(inv, now)).toBe(true)
  })

  it("SENT + before dueDate -> false", () => {
    const now = new Date(Date.UTC(2026, 1, 3))
    const inv = { status: "SENT" as const, paidAt: null, periodMonth: "2026-01" }
    expect(isInvoiceOverdue(inv, now)).toBe(false)
  })

  it("PAID -> false", () => {
    const now = new Date(Date.UTC(2026, 1, 10))
    const inv = { status: "PAID" as const, paidAt: new Date(Date.UTC(2026, 1, 1)), periodMonth: "2026-01" }
    expect(isInvoiceOverdue(inv, now)).toBe(false)
  })

  it("DRAFT -> false", () => {
    const now = new Date(Date.UTC(2026, 1, 10))
    const inv = { status: "DRAFT" as const, paidAt: null, periodMonth: "2026-01" }
    expect(isInvoiceOverdue(inv, now)).toBe(false)
  })
})
