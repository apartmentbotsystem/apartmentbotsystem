function parseGraceDays(): number {
  const v = Number(process.env.INVOICE_GRACE_DAYS)
  if (!Number.isFinite(v) || v <= 0) return 5
  return Math.floor(v)
}

function endOfMonthISO(periodMonth: string): Date {
  const parts = String(periodMonth).split("-")
  const year = Number(parts[0])
  const month = Number(parts[1])
  const end = new Date(Date.UTC(year, month, 0))
  return end
}

export function isInvoiceOverdue(
  invoice: { status: "DRAFT" | "SENT" | "PAID" | "CANCELLED"; paidAt: Date | null; periodMonth: string },
  now: Date = new Date(),
): boolean {
  if (invoice.status !== "SENT") return false
  if (invoice.paidAt) return false
  const grace = parseGraceDays()
  const base = endOfMonthISO(invoice.periodMonth)
  const due = new Date(base.getTime() + grace * 24 * 60 * 60 * 1000)
  return now.getTime() > due.getTime()
}
