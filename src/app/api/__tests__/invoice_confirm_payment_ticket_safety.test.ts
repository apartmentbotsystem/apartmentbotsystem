import { describe, it, expect, vi, beforeEach } from "vitest"

function makeReq(url: string, init?: RequestInit, headers?: Record<string, string>) {
  const h = new Headers(init?.headers || {})
  if (headers) for (const [k, v] of Object.entries(headers)) h.set(k, v)
  return new Request(url, { ...init, headers: h })
}

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

vi.mock("@/lib/guards", () => ({
  requireRole: async () => ({ userId: "admin-1", role: "ADMIN" }),
}))

describe("Confirm Payment does not mutate ticket", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("PAID invoice without any ticket updates", async () => {
    const updates: Array<{ model: string; data: Record<string, unknown> }> = []
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        tenant: {
          findUnique: async () => ({ id: "t1", lineUserId: "u-1" }),
        },
        adminAuditLog: {
          create: async () => ({}),
        },
        invoice_update_calls: updates,
        ticket: {
          update: async ({ data }: { data: Record<string, unknown> }) => {
            updates.push({ model: "ticket", data })
            return {}
          },
        },
        invoice_update: async ({ data }: { data: Record<string, unknown> }) => {
          updates.push({ model: "invoice", data })
          return {}
        },
        invoice: {
          findUnique: async () => ({ id: "inv-1", status: "SENT", periodMonth: "2026-01", tenantId: "t1" }),
          update: async ({ data }: { data: Record<string, unknown> }) => {
            updates.push({ model: "invoice", data })
            return {}
          },
        },
        idempotencyKey: {
          findFirst: async () => null,
          create: async () => ({}),
        },
        $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma as unknown),
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/invoices/[id]/confirm-payment/route")
    const req = makeReq(
      "http://localhost/api/admin/invoices/inv-1/confirm-payment",
      { method: "POST", body: JSON.stringify({ paymentNote: "ok" }) },
      { "content-type": "application/json", accept: AcceptEnvelope, "x-idempotency-key": "key-1" },
    )
    const res = await route.POST(req, { params: Promise.resolve({ id: "inv-1" }) })
    expect(res.status).toBe(200)
    const hasTicketUpdate = updates.some((u) => u.model === "ticket")
    expect(hasTicketUpdate).toBe(false)
    const hasInvoiceUpdate = updates.some((u) => u.model === "invoice")
    expect(hasInvoiceUpdate).toBe(true)
  })
})
