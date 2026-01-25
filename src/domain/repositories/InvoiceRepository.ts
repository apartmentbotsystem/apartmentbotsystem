import { Invoice } from "@/domain/entities/Invoice"
import type { InvoiceStatus } from "@/domain/invoice-status"

export type CreateInvoiceInput = {
  roomId: string
  tenantId: string
  amount: number
  month: string
}

export interface InvoiceRepository {
  create(input: CreateInvoiceInput): Promise<Invoice>
  createDraft(input: CreateInvoiceInput): Promise<Invoice>
  transitionStatus(id: string, to: InvoiceStatus): Promise<void>
  exists(input: { roomId: string; tenantId: string; month: string }): Promise<boolean>
}
