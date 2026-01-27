export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "CANCELLED"

export function assertInvoiceTransition(from: InvoiceStatus, to: InvoiceStatus): void {
  const allowed: Record<InvoiceStatus, InvoiceStatus[]> = {
    DRAFT: ["SENT", "CANCELLED"],
    SENT: ["PAID", "CANCELLED"],
    PAID: [],
    CANCELLED: [],
  }
  const nexts = allowed[from] || []
  if (!nexts.includes(to)) {
    throw new Error(`Invalid invoice transition: ${from} -> ${to}`)
  }
}
