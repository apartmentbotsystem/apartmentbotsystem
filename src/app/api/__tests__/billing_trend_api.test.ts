import { describe, it, expect, vi, beforeEach } from "vitest"

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

describe("Admin Billing Trend API", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    vi.clearAllMocks()
    process.env.NODE_ENV = "development"
  })

  it("returns 6 months ordered with correct collectionRate", async () => {
    vi.doMock("@/lib/auth.config", () => ({
      auth: async () => ({ userId: "admin-1", role: "ADMIN", capabilities: [] }),
    }))
    const now = new Date(Date.UTC(2026, 0, 15)) // Jan 15, 2026
    vi.setSystemTime(now)
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findMany: vi.fn(async () => {
            const months = ["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01"]
            const rows: Array<{ periodMonth: string; status: string; totalAmount: number }> = []
            for (const m of months) {
              rows.push({ periodMonth: m, status: "SENT", totalAmount: 1000 })
              rows.push({ periodMonth: m, status: "PAID", totalAmount: 500 })
            }
            return rows
          }),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/billing/trend/route")
    const req = new Request("http://localhost/api/admin/billing/trend", { method: "GET", headers: { accept: AcceptEnvelope } })
    const res = await route.GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    const items = json.data.items
    expect(items.length).toBe(6)
    expect(items[0].month).toBe("2025-08")
    expect(items[5].month).toBe("2026-01")
    expect(items[0].billed).toBe(1500)
    expect(items[0].collected).toBe(500)
    expect(Math.round(items[0].collectionRate)).toBe(33)
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
    const route = await import("@/app/api/admin/billing/trend/route")
    const req = new Request("http://localhost/api/admin/billing/trend", { method: "GET" })
    const res = await route.GET(req)
    expect(res.status).toBe(403)
  })
})
