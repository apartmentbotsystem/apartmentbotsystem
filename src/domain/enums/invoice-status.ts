export const InvoiceStatus = {
  UNPAID: "UNPAID",
  PAID: "PAID",
} as const
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus]
