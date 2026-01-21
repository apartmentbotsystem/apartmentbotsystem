import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import type { InvoiceRepository, CreateInvoiceInput } from "@/domain/repositories/InvoiceRepository"
import { Invoice } from "@/domain/entities/Invoice"

export class PrismaInvoiceRepository implements InvoiceRepository {
  async create(input: CreateInvoiceInput): Promise<Invoice> {
    const row = await prisma.invoice.create({
      data: {
        roomId: input.roomId,
        tenantId: input.tenantId,
        amount: input.amount,
        month: input.month,
      },
    })
    return new Invoice(row.id, row.roomId, row.tenantId, Number(row.amount), row.month)
  }
}
