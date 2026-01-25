import { describe, it, expect, vi } from "vitest"
import { PrismaPaymentRepository } from "@/infrastructure/db/prisma/repositories/PrismaPaymentRepository"
import type { Prisma } from "@prisma/client"

vi.mock("@/infrastructure/db/prisma/prismaClient", () => {
  type InvoiceRow = { id: string; status: string; totalAmount: number; paidAt?: Date | null }
  type PaymentRow = { invoiceId: string; amount: number; method: string; reference: string | null; paidAt: Date }
  const invoiceStore: Record<string, InvoiceRow> = {
    "inv-issued": { id: "inv-issued", status: "ISSUED", totalAmount: 1000 },
    "inv-draft": { id: "inv-draft", status: "DRAFT", totalAmount: 1000 },
  }
  const payments: PaymentRow[] = []
  const tx = {
    invoice: {
      findUnique: async ({ where }: { where: { id: string } }): Promise<InvoiceRow | null> =>
        invoiceStore[where.id] ? { ...invoiceStore[where.id] } : null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string }
        data: { status: "DRAFT" | "ISSUED" | "PAID" | "CANCELLED"; paidAt: Date }
      }): Promise<InvoiceRow> => {
        const inv = invoiceStore[where.id]
        if (!inv) throw new Error("Invoice not found")
        invoiceStore[where.id] = { ...inv, status: data.status, paidAt: data.paidAt }
        return { ...invoiceStore[where.id] }
      },
    },
    payment: {
      create: async ({ data }: { data: PaymentRow }): Promise<{ id: string } & PaymentRow> => {
        payments.push({ ...data })
        return { id: "pay-1", ...data }
      },
    },
  }
  return {
    prisma: {
      $transaction: async (fn: (tx: Prisma.TransactionClient) => unknown | Promise<unknown>): Promise<unknown> =>
        fn(tx as unknown as Prisma.TransactionClient),
    },
  }
})

describe("Payment confirmation", () => {
  it("fails when invoice is not ISSUED", async () => {
    const repo = new PrismaPaymentRepository()
    await expect(
      repo.record({ invoiceId: "inv-draft", method: "CASH", reference: null }),
    ).rejects.toThrowError(/not payable/)
  })

  it("succeeds and sets status to PAID when ISSUED", async () => {
    const repo = new PrismaPaymentRepository()
    const res = await repo.record({ invoiceId: "inv-issued", method: "CASH", reference: null })
    expect(res.invoiceId).toBe("inv-issued")
    expect(res.method).toBe("CASH")
    expect(res.paidAt).toBeInstanceOf(Date)
  })
})
