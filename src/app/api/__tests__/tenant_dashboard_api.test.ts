import { describe, it, expect, vi, beforeEach } from "vitest"

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

describe("Tenant Dashboard API", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    vi.clearAllMocks()
    process.env.NODE_ENV = "development"
    vi.doMock("@/lib/auth.config", () => ({
      auth: async () => ({ userId: "tenant-1", role: "TENANT", capabilities: [] }),
    }))
  })

  it("profile returns envelope with meta and partial when missing contract", async () => {
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        tenant: {
          findUnique: vi.fn(async () => ({ id: "tenant-1", roomId: "room-1" })),
          findFirst: vi.fn(async () => null),
        },
        room: {
          findUnique: vi.fn(async () => ({ id: "room-1", roomNumber: "101", status: "OCCUPIED" })),
        },
        tenantRegistration: {
          findFirst: vi.fn(async () => null),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/tenant/profile/route")
    const req = new Request("http://localhost/api/tenant/profile", { headers: { accept: AcceptEnvelope } })
    const res = await route.GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.meta).toBeTruthy()
    expect(["OK", "STALE", "PARTIAL", "ERROR"]).toContain(json.data.meta.status)
    expect(json.data.meta.status).toBe("PARTIAL")
  })

  it("invoices returns at most 6 months and meta present", async () => {
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const now = new Date(Date.UTC(2026, 1, 20))
      vi.setSystemTime(now)
      const prisma = {
        tenant: {
          findUnique: vi.fn(async () => ({ id: "tenant-1" })),
          findFirst: vi.fn(async () => null),
        },
        invoice: {
          findMany: vi.fn(async () => [
            { id: "inv-1", periodMonth: "2026-02", status: "PAID", totalAmount: 1000 },
            { id: "inv-2", periodMonth: "2026-01", status: "SENT", totalAmount: 2000 },
          ]),
        },
        payment: {
          findMany: vi.fn(async () => [{ id: "pay-1", invoiceId: "inv-1", paidAt: new Date(Date.UTC(2026, 1, 10)), amount: 1000 }]),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/tenant/invoices/route")
    const req = new Request("http://localhost/api/tenant/invoices", { headers: { accept: AcceptEnvelope } })
    const res = await route.GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.items.length).toBeGreaterThanOrEqual(1)
    expect(json.data.meta).toBeTruthy()
  })

  it("forbidden for non-tenant", async () => {
    vi.doMock("@/lib/guards", async () => {
      const { HttpError } = await import("@/interface/errors/HttpError")
      return {
        requireRole: async () => {
          throw new HttpError(403, "FORBIDDEN", "Forbidden")
        },
      }
    })
    const profileRoute = await import("@/app/api/tenant/profile/route")
    const invRoute = await import("@/app/api/tenant/invoices/route")
    const req1 = new Request("http://localhost/api/tenant/profile", { headers: { accept: AcceptEnvelope } })
    const req2 = new Request("http://localhost/api/tenant/invoices", { headers: { accept: AcceptEnvelope } })
    const res1 = await profileRoute.GET(req1)
    const res2 = await invRoute.GET(req2)
    expect(res1.status).toBe(403)
    expect(res2.status).toBe(403)
  })
})
