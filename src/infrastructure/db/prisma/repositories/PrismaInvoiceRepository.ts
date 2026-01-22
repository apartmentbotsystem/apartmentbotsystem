import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import type { InvoiceRepository, CreateInvoiceInput } from "@/domain/repositories/InvoiceRepository"
import { Invoice } from "@/domain/entities/Invoice"

export class PrismaInvoiceRepository implements InvoiceRepository {
  async create(input: CreateInvoiceInput): Promise<Invoice> {
    const dueDate = (() => {
      const parts = String(input.month).split("-")
      const year = Number(parts[0])
      const monthIndex = Number(parts[1]) // 1-based
      return new Date(Date.UTC(year, monthIndex, 0))
    })()
    const row = await prisma.invoice.create({
      data: {
        roomId: input.roomId,
        tenantId: input.tenantId,
        periodMonth: input.month,
        rentAmount: input.amount,
        waterAmount: 0,
        electricAmount: 0,
        totalAmount: input.amount,
        status: "UNPAID",
        issuedAt: new Date(),
        dueDate,
      },
    })
    return new Invoice(row.id, row.roomId, row.tenantId, Number(row.totalAmount), row.periodMonth)
  }
}
