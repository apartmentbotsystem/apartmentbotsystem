import type { PaymentRepository, RecordPaymentInput } from "@/domain/repositories/PaymentRepository"
import { Payment } from "@/domain/entities/Payment"

export class RecordPaymentUseCase {
  constructor(private readonly repo: PaymentRepository) {}

  async execute(input: RecordPaymentInput): Promise<Payment> {
    return this.repo.record(input)
  }
}

