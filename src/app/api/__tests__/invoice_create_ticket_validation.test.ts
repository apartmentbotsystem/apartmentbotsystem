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

describe("Invoice Create with ticketId validation", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("409 when ticket is CLOSED", async () => {
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        ticket: {
          findUnique: async () => ({ status: "CLOSED" }),
        },
        invoice: {
          create: async () => ({ id: "inv-1", roomId: "r1", tenantId: "t1", totalAmount: 5000, periodMonth: "2026-01" }),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/invoices/route")
    const req = makeReq(
      "http://localhost/api/invoices",
      { method: "POST", body: JSON.stringify({ roomId: "r1", tenantId: "t1", amount: 5000, month: "2026-01", ticketId: "tick-1" }) },
      { "content-type": "application/json", accept: AcceptEnvelope },
    )
    const res = await route.POST(req)
    expect(res.status).toBe(409)
  })

  it("404 when ticket not found", async () => {
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        ticket: {
          findUnique: async () => null,
        },
        invoice: {
          create: async () => ({ id: "inv-1", roomId: "r1", tenantId: "t1", totalAmount: 5000, periodMonth: "2026-01" }),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/invoices/route")
    const req = makeReq(
      "http://localhost/api/invoices",
      { method: "POST", body: JSON.stringify({ roomId: "r1", tenantId: "t1", amount: 5000, month: "2026-01", ticketId: "tick-2" }) },
      { "content-type": "application/json", accept: AcceptEnvelope },
    )
    const res = await route.POST(req)
    expect(res.status).toBe(404)
  })

  it("201 when ticket is OPEN and audit metadata includes ticketId", async () => {
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const auditCalls: Array<Record<string, unknown>> = []
      const prisma = {
        ticket: { findUnique: async () => ({ status: "OPEN" }) },
        invoice: {
          create: async ({ data }: { data: Record<string, unknown> }) => ({
            id: "inv-3",
            roomId: String(data.roomId),
            tenantId: String(data.tenantId),
            totalAmount: Number(data.totalAmount ?? data.amount ?? 5000),
            periodMonth: String(data.periodMonth ?? data.month ?? "2026-01"),
          }),
        },
        auditEvent: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            auditCalls.push(data)
            return { id: "ae-1" }
          },
        },
      }
      return { prisma, __auditCalls: auditCalls }
    })
    const route = await import("@/app/api/invoices/route")
    const req = makeReq(
      "http://localhost/api/invoices",
      { method: "POST", body: JSON.stringify({ roomId: "r1", tenantId: "t1", amount: 5000, month: "2026-01", ticketId: "tick-open" }) },
      { "content-type": "application/json", accept: AcceptEnvelope },
    )
    const res = await route.POST(req)
    expect(res.status).toBe(201)
    const { __auditCalls } = await import("@/infrastructure/db/prisma/prismaClient")
    const found = (__auditCalls as unknown as Array<{ metadata?: Record<string, unknown> }>).find((c) => c.metadata && c.metadata["ticketId"] === "tick-open")
    expect(Boolean(found)).toBe(true)
  })
})
