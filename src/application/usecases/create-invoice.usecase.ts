import type { InvoiceRepository, CreateInvoiceInput } from "@/domain/repositories/InvoiceRepository"
import { Invoice } from "@/domain/entities/Invoice"

export class CreateInvoiceUseCase {
  constructor(private readonly repo: InvoiceRepository) {}

  async execute(input: CreateInvoiceInput): Promise<Invoice> {
    return this.repo.create(input)
  }
}

