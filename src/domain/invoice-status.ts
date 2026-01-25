export type InvoiceStatus = "DRAFT" | "ISSUED" | "PAID" | "CANCELLED"

export function assertInvoiceTransition(from: InvoiceStatus, to: InvoiceStatus): void {
  const allowed: Record<InvoiceStatus, InvoiceStatus[]> = {
    DRAFT: ["ISSUED", "CANCELLED"],
    ISSUED: ["PAID", "CANCELLED"],
    PAID: [],
    CANCELLED: [],
  }
  const nexts = allowed[from] || []
  if (!nexts.includes(to)) {
    throw new Error(`Invalid invoice transition: ${from} -> ${to}`)
  }
}
