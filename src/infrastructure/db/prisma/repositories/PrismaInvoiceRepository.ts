import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import type { InvoiceRepository, CreateInvoiceInput } from "@/domain/repositories/InvoiceRepository"
import { Invoice } from "@/domain/entities/Invoice"
import { assertInvoiceTransition } from "@/domain/invoice-status"
import type { InvoiceStatus } from "@/domain/invoice-status"

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
        status: "DRAFT",
        dueDate,
      },
    })
    return new Invoice(row.id, row.roomId, row.tenantId, Number(row.totalAmount), row.periodMonth)
  }

  async createDraft(input: CreateInvoiceInput): Promise<Invoice> {
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
        status: "DRAFT",
        dueDate,
      },
    })
    return new Invoice(row.id, row.roomId, row.tenantId, Number(row.totalAmount), row.periodMonth)
  }

  async transitionStatus(id: string, to: InvoiceStatus): Promise<void> {
    const current = await prisma.invoice.findUnique({ where: { id } })
    if (!current) throw new Error("Invoice not found")
    assertInvoiceTransition(current.status as InvoiceStatus, to)
    await prisma.invoice.update({
      where: { id },
      data: {
        status: to,
        sentAt: to === "SENT" ? new Date() : current.sentAt ?? undefined,
      },
    })
  }

  async exists(input: { roomId: string; tenantId: string; month: string }): Promise<boolean> {
    const found = await prisma.invoice.findFirst({
      where: { roomId: input.roomId, tenantId: input.tenantId, periodMonth: input.month },
      select: { id: true },
    })
    return !!found
  }
}
