import { describe, it, expect, vi, beforeEach } from "vitest"

describe("Billing Metrics Overview API", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    vi.clearAllMocks()
    process.env.NODE_ENV = "development"
    vi.doMock("@/lib/guards", () => ({
      requireRole: async () => ({ userId: "admin-1", role: "ADMIN" }),
    }))
  })

  it("returns 400 for invalid month format (envelope)", async () => {
    const route = await import("@/app/api/metrics/billing/overview/route")
    const res = await route.GET(new Request("http://localhost/api/metrics/billing/overview?month=2025-1", { headers: { accept: "application/vnd.apartment.v1.1+json" } }))
    expect(res.status).toBe(400)
  })

  it("handles empty month with zeros and empty trends", async () => {
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findMany: vi.fn(async () => []),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/metrics/billing/overview/route")
    const res = await route.GET(new Request("http://localhost/api/metrics/billing/overview?month=2025-01", { headers: { accept: "application/vnd.apartment.v1.1+json" } }))
    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      success: boolean
      data: {
        periodMonth: string
        totals: { issuedCount: number; sentCount: number; paidCount: number; unpaidCount: number }
        amounts: { paidTotal: number; unpaidTotal: number }
        trends: { sentDaily: Array<{ date: string; count: number }>; paidDaily: Array<{ date: string; count: number }> }
      }
    }
    expect(json.success).toBe(true)
    expect(json.data.periodMonth).toBe("2025-01")
    expect(json.data.totals.issuedCount).toBe(0)
    expect(json.data.totals.sentCount).toBe(0)
    expect(json.data.totals.paidCount).toBe(0)
    expect(json.data.totals.unpaidCount).toBe(0)
    expect(json.data.amounts.paidTotal).toBe(0)
    expect(json.data.amounts.unpaidTotal).toBe(0)
    expect(Array.isArray(json.data.trends.sentDaily)).toBe(true)
    expect(Array.isArray(json.data.trends.paidDaily)).toBe(true)
    expect(json.data.trends.sentDaily.every((d) => typeof d.date === "string" && typeof d.count === "number")).toBe(true)
    expect(json.data.trends.paidDaily.every((d) => typeof d.date === "string" && typeof d.count === "number")).toBe(true)
  })

  it("computes totals and trends for a sample month", async () => {
    const month = "2026-02"
    const sent1 = new Date(Date.UTC(2026, 1, 5))
    const sent2 = new Date(Date.UTC(2026, 1, 6))
    const paid1 = new Date(Date.UTC(2026, 1, 10))
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findMany: vi.fn(async () => [
            { periodMonth: month, status: "SENT", totalAmount: 3000, sentAt: sent1, paidAt: null },
            { periodMonth: month, status: "SENT", totalAmount: 2000, sentAt: sent2, paidAt: null },
            { periodMonth: month, status: "PAID", totalAmount: 5000, sentAt: sent1, paidAt: paid1 },
            { periodMonth: month, status: "DRAFT", totalAmount: 1000, sentAt: null, paidAt: null },
          ]),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/metrics/billing/overview/route")
    const res = await route.GET(new Request(`http://localhost/api/metrics/billing/overview?month=${month}`, { headers: { accept: "application/vnd.apartment.v1.1+json" } }))
    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      success: boolean
      data: {
        periodMonth: string
        totals: { issuedCount: number; sentCount: number; paidCount: number; unpaidCount: number }
        amounts: { paidTotal: number; unpaidTotal: number }
        trends: { sentDaily: Array<{ date: string; count: number }>; paidDaily: Array<{ date: string; count: number }> }
      }
    }
    expect(json.success).toBe(true)
    expect(json.data.periodMonth).toBe(month)
    expect(json.data.totals.issuedCount).toBe(4) // all except CANCELLED
    expect(json.data.totals.sentCount).toBe(2)
    expect(json.data.totals.paidCount).toBe(1)
    expect(json.data.totals.unpaidCount).toBe(2)
    expect(json.data.amounts.paidTotal).toBe(5000)
    expect(json.data.amounts.unpaidTotal).toBe(5000)
    const sentOn5 = json.data.trends.sentDaily.find((x) => x.date === "2026-02-05")
    const sentOn6 = json.data.trends.sentDaily.find((x) => x.date === "2026-02-06")
    const paidOn10 = json.data.trends.paidDaily.find((x) => x.date === "2026-02-10")
    expect(sentOn5?.count).toBe(2) // two invoices have sentAt on 5th
    expect(sentOn6?.count).toBe(1)
    expect(paidOn10?.count).toBe(1)
  })
})
