import { Payment } from "@/domain/entities/Payment"

export type RecordPaymentInput = {
  invoiceId: string
  method: string
  reference?: string | null
}

export interface PaymentRepository {
  findById(id: string): Promise<Payment | null>
  findAll(filter?: PaymentFindFilter): Promise<Payment[]>
  create(input: CreatePaymentInput): Promise<Payment>
  update(id: string, patch: UpdatePaymentPatch): Promise<Payment>
  delete(id: string): Promise<void>
  record(input: RecordPaymentInput): Promise<Payment>
}

export type PaymentFindFilter = {
  invoiceId?: string
  method?: string
  paidAfter?: Date
  paidBefore?: Date
}

export type CreatePaymentInput = {
  invoiceId: string
  method: string
  reference?: string | null
  paidAt: Date
}

export type UpdatePaymentPatch = {
  method?: string
  reference?: string | null
  paidAt?: Date
}
