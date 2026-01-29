export type ReportedPaymentDTO = {
  invoiceId: string
  tenant: { id: string; name: string } | null
  room: { id: string; roomNumber: string } | null
  periodMonth: string
  amount: number
  invoiceStatus: "DRAFT" | "SENT" | "PAID" | "CANCELLED"
  reportedAt: string
  pending: boolean
  resolved: boolean
  lineUserIdMasked?: string
}

export type ReportedPaymentListDTO = {
  items: ReadonlyArray<ReportedPaymentDTO>
}

