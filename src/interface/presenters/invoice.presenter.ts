import { Invoice } from "@/domain/entities/Invoice"
import type { InvoiceDTO } from "@/application/dto/invoice.dto"

export function presentInvoiceDTO(inv: Invoice): InvoiceDTO {
  return {
    id: inv.id,
    roomId: inv.roomId,
    tenantId: inv.tenantId,
    amount: inv.amount,
    month: inv.month,
  }
}

