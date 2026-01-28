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

describe("Audit chain consistency: ticket → invoice → payment", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("links invoice creation to ticket via audit metadata; payment writes invoice timeline", async () => {
    const auditCalls: Array<Record<string, unknown>> = []
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        ticket: { findUnique: async () => ({ status: "OPEN" }) },
        invoice: {
          create: async ({ data }: { data: Record<string, unknown> }) => ({
            id: "inv-chain-1",
            roomId: String(data.roomId),
            tenantId: String(data.tenantId),
            totalAmount: Number(data.totalAmount ?? data.amount ?? 5000),
            periodMonth: String(data.periodMonth ?? data.month ?? "2026-01"),
            status: "DRAFT",
          }),
          findUnique: async () => ({ id: "inv-chain-1", status: "SENT", periodMonth: "2026-01", tenantId: "t1", issuedAt: new Date() }),
          update: async ({ data }: { data: Record<string, unknown> }) => ({ id: "inv-chain-1", ...data }),
        },
        tenant: {
          findUnique: async () => ({ id: "t1", lineUserId: "u-1" }),
        },
        auditEvent: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            auditCalls.push(data)
            return { id: `ae-${auditCalls.length}` }
          },
          findMany: async ({ where }: { where: { targetType: string; targetId: string } }) => {
            return auditCalls
              .filter((a) => a.targetType === where.targetType && a.targetId === where.targetId)
              .map((a, i) => ({ id: `ae-${i + 1}`, timestamp: new Date(), actorType: "ADMIN", actorId: "admin-1", action: String(a.action), severity: "INFO", metadata: a.metadata ?? null }))
          },
        },
        adminAuditLog: { create: async () => ({}) },
        idempotencyKey: { findFirst: async () => null, create: async () => ({}) },
        $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma as unknown),
      }
      return { prisma, __auditCalls: auditCalls }
    })
    // Create invoice with ticketId
    {
      const route = await import("@/app/api/invoices/route")
      const req = makeReq(
        "http://localhost/api/invoices",
        { method: "POST", body: JSON.stringify({ roomId: "r1", tenantId: "t1", amount: 5000, month: "2026-01", ticketId: "tick-anchor" }) },
        { "content-type": "application/json", accept: AcceptEnvelope },
      )
      const res = await route.POST(req)
      expect(res.status).toBe(201)
    }
    // Confirm payment (idempotent path not needed here)
    {
      const route = await import("@/app/api/admin/invoices/[id]/confirm-payment/route")
      const req = makeReq(
        "http://localhost/api/admin/invoices/inv-chain-1/confirm-payment",
        { method: "POST", body: JSON.stringify({ paymentNote: "ok" }) },
        { "content-type": "application/json", accept: AcceptEnvelope, "x-idempotency-key": "key-chain-1" },
      )
      const res = await route.POST(req, { params: Promise.resolve({ id: "inv-chain-1" }) })
      expect(res.status).toBe(200)
    }
    // Read invoice timeline and verify chain references exist
    {
      const route = await import("@/app/api/admin/invoices/[id]/timeline/route")
      const req = makeReq("http://localhost/api/admin/invoices/inv-chain-1/timeline", { method: "GET" }, { accept: AcceptEnvelope })
      const res = await route.GET(req, { params: Promise.resolve({ id: "inv-chain-1" }) })
      expect(res.status).toBe(200)
      const json = await res.json()
      const items = json.data.items as Array<{ action: string }>
      const hasPaid = items.some((i) => i.action === "INVOICE_PAID")
      expect(hasPaid).toBe(true)
    }
    // Cross-check audit calls: invoice created has ticketId metadata
    {
      const mod = await import("@/infrastructure/db/prisma/prismaClient")
      const calls = (mod.__auditCalls as unknown as Array<{ action?: string; metadata?: Record<string, unknown>; targetType?: string }>) || []
      const invCreate = calls.find((c) => c.action === "INVOICE_CREATED" && c.targetType === "INVOICE")
      expect(invCreate?.metadata && invCreate.metadata["ticketId"]).toBe("tick-anchor")
    }
  })
})
