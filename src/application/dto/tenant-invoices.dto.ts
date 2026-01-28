export type TenantInvoicesDTO = {
  items: ReadonlyArray<{
    month: string
    amount: number
    status: "PAID" | "UNPAID"
    invoiceId: string
    payments?: ReadonlyArray<{ paymentId: string; paidAt: string; amount: number }>
  }>
  meta: {
    status: "OK" | "STALE" | "PARTIAL" | "ERROR"
    calculatedAt: string
    freshnessMs?: number
    reason?: string
  }
}
