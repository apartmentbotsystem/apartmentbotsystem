import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import type {
  PaymentRepository,
  PaymentFindFilter,
  CreatePaymentInput,
  UpdatePaymentPatch,
  RecordPaymentInput,
} from "@/domain/repositories/PaymentRepository"
import { Payment } from "@/domain/entities/Payment"
type PaymentRow = Awaited<ReturnType<typeof prisma.payment.findMany>>[number]

export class PrismaPaymentRepository implements PaymentRepository {
  private toDomain(row: PaymentRow): Payment {
    return new Payment(row.id, row.invoiceId, row.method, row.reference ?? null, new Date(row.paidAt))
  }

  async findById(id: string): Promise<Payment | null> {
    const row = await prisma.payment.findUnique({ where: { id } })
    return row ? this.toDomain({ ...row }) : null
  }

  async findAll(filter?: PaymentFindFilter): Promise<Payment[]> {
    const where: Record<string, unknown> = {}
    if (filter?.invoiceId) where.invoiceId = filter.invoiceId
    if (filter?.method) where.method = filter.method
    if (filter?.paidAfter || filter?.paidBefore) {
      const paidRange: Record<string, Date> = {}
      if (filter.paidAfter) paidRange.gte = filter.paidAfter
      if (filter.paidBefore) paidRange.lte = filter.paidBefore
      if (Object.keys(paidRange).length > 0) where.paidAt = paidRange
    }
    const rows = await prisma.payment.findMany({ where, orderBy: { paidAt: "desc" }, take: 200 })
    return rows.map((r: PaymentRow) => this.toDomain({ ...r }))
  }

  async create(input: CreatePaymentInput): Promise<Payment> {
    const row = await prisma.payment.create({
      data: {
        invoiceId: input.invoiceId,
        amount: input.amount ?? 0,
        method: input.method,
        reference: input.reference ?? null,
        paidAt: input.paidAt,
      },
    })
    return this.toDomain({ ...row })
  }

  async update(id: string, patch: UpdatePaymentPatch): Promise<Payment> {
    const row = await prisma.payment.update({
      where: { id },
      data: {
        method: patch.method,
        reference: patch.reference ?? null,
        paidAt: patch.paidAt,
      },
    })
    return this.toDomain({ ...row })
  }

  async delete(id: string): Promise<void> {
    await prisma.payment.delete({ where: { id } })
  }

  async record(input: RecordPaymentInput): Promise<Payment> {
    const row = await prisma.payment.create({
      data: {
        invoiceId: input.invoiceId,
        amount: 0,
        method: input.method,
        reference: input.reference ?? null,
        paidAt: new Date(),
      },
    })
    return this.toDomain({ ...row })
  }
}
