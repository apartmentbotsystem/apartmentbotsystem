import { Invoice } from "@/domain/entities/Invoice"

export type CreateInvoiceInput = {
  roomId: string
  tenantId: string
  amount: number
  month: string
}

export interface InvoiceRepository {
  create(input: CreateInvoiceInput): Promise<Invoice>
}

