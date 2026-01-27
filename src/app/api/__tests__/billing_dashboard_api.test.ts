import { describe, it, expect, vi, beforeEach } from "vitest"

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

describe("Admin Billing Dashboard API", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    vi.clearAllMocks()
    process.env.NODE_ENV = "development"
  })

  it("computes KPIs and aging buckets correctly", async () => {
    vi.doMock("@/lib/auth.config", () => ({
      auth: async () => ({ userId: "admin-1", role: "ADMIN", capabilities: [] }),
    }))
    const now = new Date(Date.UTC(2026, 1, 20))
    vi.setSystemTime(now)
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findMany: vi.fn(async () => [
            { periodMonth: "2026-01", status: "SENT", totalAmount: 3000, paidAt: null },
            { periodMonth: "2026-01", status: "SENT", totalAmount: 2000, paidAt: null },
            { periodMonth: "2026-01", status: "PAID", totalAmount: 5000, paidAt: new Date(Date.UTC(2026, 1, 10)) },
            { periodMonth: "2026-01", status: "DRAFT", totalAmount: 1000, paidAt: null },
          ]),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/billing/dashboard/route")
    const req = new Request("http://localhost/api/admin/billing/dashboard?month=2026-01", { method: "GET", headers: { accept: AcceptEnvelope } })
    const res = await route.GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    const data = json.data
    expect(data.month).toBe("2026-01")
    expect(data.kpis.billed).toBe(10000) // SENT(3000+2000) + PAID(5000)
    expect(data.kpis.collected).toBe(5000) // PAID only
    expect(data.kpis.outstanding).toBe(5000) // SENT only
    expect(Math.round(data.kpis.collectionRate)).toBe(50)
    expect(typeof data.aging["0_7"]).toBe("number")
    expect(typeof data.aging["8_30"]).toBe("number")
    expect(typeof data.aging["31_60"]).toBe("number")
    expect(typeof data.aging["60_plus"]).toBe("number")
  })

  it("aging buckets categorize overdue outstanding correctly", async () => {
    vi.doMock("@/lib/auth.config", () => ({
      auth: async () => ({ userId: "admin-1", role: "ADMIN", capabilities: [] }),
    }))
    const now = new Date(Date.UTC(2026, 1, 20)) // Feb 20, 2026
    vi.setSystemTime(now)
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      // periodMonth=2026-01 => end Jan 31, grace 5 => due Feb 5
      // days late at Feb 20 => 15
      const prisma = {
        invoice: {
          findMany: vi.fn(async () => [
            { periodMonth: "2026-01", status: "SENT", totalAmount: 1000, paidAt: null }, // 15 days late -> 8_30
            { periodMonth: "2026-01", status: "SENT", totalAmount: 800, paidAt: null }, // 15 days late -> 8_30
            { periodMonth: "2026-01", status: "SENT", totalAmount: 300, paidAt: null }, // 15 days late -> 8_30
            { periodMonth: "2026-01", status: "PAID", totalAmount: 2000, paidAt: new Date(Date.UTC(2026, 1, 6)) }, // collected only
          ]),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/billing/dashboard/route")
    const req = new Request("http://localhost/api/admin/billing/dashboard?month=2026-01", { method: "GET", headers: { accept: AcceptEnvelope } })
    const res = await route.GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    const aging = json.data.aging
    expect(aging["8_30"]).toBe(2100)
    expect(aging["0_7"]).toBe(0)
    expect(aging["31_60"]).toBe(0)
    expect(aging["60_plus"]).toBe(0)
  })

  it("forbidden for non-admin", async () => {
    vi.doMock("@/lib/guards", async () => {
      const { HttpError } = await import("@/interface/errors/HttpError")
      return {
        requireRole: async () => {
          throw new HttpError(403, "FORBIDDEN", "Forbidden")
        },
      }
    })
    const route = await import("@/app/api/admin/billing/dashboard/route")
    const req = new Request("http://localhost/api/admin/billing/dashboard?month=2026-01", { method: "GET" })
    const res = await route.GET(req)
    expect(res.status).toBe(403)
  })
})
