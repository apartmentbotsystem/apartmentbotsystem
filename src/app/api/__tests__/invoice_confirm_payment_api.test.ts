import { describe, it, expect, vi, beforeEach } from "vitest"

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

describe("Admin Invoice Confirm Payment API - Idempotency", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    vi.clearAllMocks()
    process.env.NODE_ENV = "development"
    vi.doMock("@/lib/guards", () => ({
      requireRole: async () => ({ userId: "admin-1", role: "ADMIN" }),
    }))
  })

  it("idempotency key returns cached response on duplicate confirm", async () => {
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const invoiceRow = {
        id: "inv-20",
        tenantId: "tenant-20",
        roomId: "room-20",
        periodMonth: "2026-04",
        totalAmount: 5000,
        status: "SENT",
        paidAt: null,
      }
      const store: Array<{ key: string; endpoint: string; requestHash: string; responseSnapshot: unknown }> = []
      const prisma = {
        invoice: {
          findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === "inv-20" ? invoiceRow : null)),
          update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            Object.assign(invoiceRow, data)
            return { ...invoiceRow }
          }),
        },
        tenant: {
          findUnique: vi.fn(async () => ({ lineUserId: "u-20" })),
        },
        adminAuditLog: {
          create: vi.fn(async () => ({})),
        },
        idempotencyKey: {
          findFirst: vi.fn(async ({ where }: { where: { key: string; endpoint: string } }) =>
            store.find((x) => x.key === where.key && x.endpoint === where.endpoint) ?? null,
          ),
          create: vi.fn(async ({ data }: { data: { key: string; endpoint: string; requestHash: string; responseSnapshot: unknown } }) => {
            store.push({ ...data })
            return { id: `k${store.length}`, ...data }
          }),
        },
        $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma as unknown)),
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/invoices/[id]/confirm-payment/route")
    const req1 = new Request("http://localhost/api/admin/invoices/inv-20/confirm-payment", {
      method: "POST",
      headers: { accept: AcceptEnvelope, "content-type": "application/json", "x-idempotency-key": "key-confirm-1" },
      body: JSON.stringify({ paymentNote: "paid at desk" }),
    })
    const res1 = await route.POST(req1, { params: Promise.resolve({ id: "inv-20" }) })
    expect(res1.status).toBe(200)
    const req2 = new Request("http://localhost/api/admin/invoices/inv-20/confirm-payment", {
      method: "POST",
      headers: { accept: AcceptEnvelope, "content-type": "application/json", "x-idempotency-key": "key-confirm-1" },
      body: JSON.stringify({ paymentNote: "paid at desk" }),
    })
    const res2 = await route.POST(req2, { params: Promise.resolve({ id: "inv-20" }) })
    expect(res2.status).toBe(200)
    const json2 = await res2.json()
    expect(json2?.data?.status).toBe("PAID")
  })
})
