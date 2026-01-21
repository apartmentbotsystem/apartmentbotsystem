export type PaymentDTO = {
  id: string
  invoiceId: string
  method: string
  reference: string | null
  paidAt: string
}

