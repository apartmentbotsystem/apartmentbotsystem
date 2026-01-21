import { Payment } from "@/domain/entities/Payment"
import type { PaymentDTO } from "@/application/dto/payment.dto"

export function presentPaymentDTO(p: Payment): PaymentDTO {
  return {
    id: p.id,
    invoiceId: p.invoiceId,
    method: p.method,
    reference: p.reference,
    paidAt: p.paidAt.toISOString(),
  }
}

