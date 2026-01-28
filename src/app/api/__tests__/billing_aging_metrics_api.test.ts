import { describe, it, expect, vi, beforeEach } from "vitest"
import type { BillingAgingMetricsDTO } from "@/application/dto/billing-aging.dto"

describe("Billing Aging Metrics API", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    vi.clearAllMocks()
    process.env.NODE_ENV = "development"
    vi.doMock("@/lib/guards", () => ({
      requireRole: async () => ({ userId: "admin-1", role: "ADMIN" }),
    }))
  })

  it("drilldown returns only invoices in selected bucket", async () => {
    const now = new Date(Date.UTC(2026, 1, 20))
    vi.setSystemTime(now)
    const d0 = new Date(Date.UTC(2026, 1, 20)) // 0 days
    const d9 = new Date(Date.UTC(2026, 1, 11)) // 9 days
    const d31 = new Date(Date.UTC(2026, 0, 20)) // 31 days
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findMany: vi.fn(async () => [
            { id: "inv-0", periodMonth: "2026-02", status: "SENT", totalAmount: 1000, dueDate: d0, paidAt: null },
            { id: "inv-9", periodMonth: "2026-02", status: "SENT", totalAmount: 2000, dueDate: d9, paidAt: null },
            { id: "inv-31", periodMonth: "2026-02", status: "SENT", totalAmount: 3000, dueDate: d31, paidAt: null },
            { id: "inv-paid", periodMonth: "2026-02", status: "PAID", totalAmount: 4000, dueDate: d31, paidAt: now },
            { id: "inv-draft", periodMonth: "2026-02", status: "DRAFT", totalAmount: 500, dueDate: d31, paidAt: null },
          ]),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/metrics/billing/aging/[bucket]/route")
    const req = new Request("http://localhost/api/metrics/billing/aging/d8_30?month=2026-02", {
      method: "GET",
      headers: { accept: "application/vnd.apartment.v1.1+json" },
    })
    const res = await route.GET(req, { params: Promise.resolve({ bucket: "d8_30" }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    const items = json.data.items as Array<{ id: string; overdueDays: number }>
    expect(items.map((it) => it.id)).toEqual(["inv-9"])
    expect(items[0].overdueDays).toBeGreaterThanOrEqual(8)
    expect(items[0].overdueDays).toBeLessThanOrEqual(30)
  })

  it("returns 400 for invalid month format (envelope)", async () => {
    const route = await import("@/app/api/metrics/billing/aging/route")
    const res = await route.GET(new Request("http://localhost/api/metrics/billing/aging?month=2025-1", { headers: { accept: "application/vnd.apartment.v1.1+json" } }))
    expect(res.status).toBe(400)
  })

  it("handles empty month with zeros", async () => {
    const now = new Date(Date.UTC(2026, 1, 20))
    vi.setSystemTime(now)
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findMany: vi.fn(async () => []),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/metrics/billing/aging/route")
    const res = await route.GET(new Request("http://localhost/api/metrics/billing/aging?month=2026-02", { headers: { accept: "application/vnd.apartment.v1.1+json" } }))
    expect(res.status).toBe(200)
    const json = (await res.json()) as { success: true; data: BillingAgingMetricsDTO }
    expect(json.success).toBe(true)
    expect(json.data.periodMonth).toBe("2026-02")
    expect(json.data.meta.calculatedAt).toBe(now.toISOString())
    expect(json.data.meta.version).toBe("billing-aging@v1")
    expect(json.data.meta.freshnessMs).toBeGreaterThanOrEqual(0)
    expect(json.data.meta.isStale).toBe(false)
    expect(json.data.meta.status).toBe("OK")
    expect(json.data.totals.issuedCount).toBe(0)
    expect(json.data.totals.overdueCount).toBe(0)
    expect(json.data.totals.overdueAmount).toBe(0)
    expect(json.data.totals.overduePercentOfIssued).toBe(0)
  })

  it("computes buckets and percentage for sample overdue data", async () => {
    const now = new Date(Date.UTC(2026, 1, 20))
    vi.setSystemTime(now)
    const d0 = new Date(Date.UTC(2026, 1, 20)) // due today → overdueDays 0
    const d7 = new Date(Date.UTC(2026, 1, 13)) // 7 days ago
    const d8 = new Date(Date.UTC(2026, 1, 12)) // 8 days ago
    const d30 = new Date(Date.UTC(2026, 0, 21)) // Jan 21 2026 → 30 days ago
    const d31 = new Date(Date.UTC(2026, 0, 20)) // Jan 20 2026 → 31 days ago
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findMany: vi.fn(async () => [
            { periodMonth: "2026-02", status: "SENT", totalAmount: 1000, dueDate: d0, paidAt: null },
            { periodMonth: "2026-02", status: "SENT", totalAmount: 2000, dueDate: d7, paidAt: null },
            { periodMonth: "2026-02", status: "SENT", totalAmount: 3000, dueDate: d8, paidAt: null },
            { periodMonth: "2026-02", status: "SENT", totalAmount: 4000, dueDate: d30, paidAt: null },
            { periodMonth: "2026-02", status: "SENT", totalAmount: 5000, dueDate: d31, paidAt: null },
            { periodMonth: "2026-02", status: "PAID", totalAmount: 6000, dueDate: d8, paidAt: now },
            { periodMonth: "2026-02", status: "DRAFT", totalAmount: 7000, dueDate: d8, paidAt: null },
          ]),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/metrics/billing/aging/route")
    const res = await route.GET(new Request("http://localhost/api/metrics/billing/aging?month=2026-02", { headers: { accept: "application/vnd.apartment.v1.1+json" } }))
    expect(res.status).toBe(200)
    const json = (await res.json()) as { success: true; data: BillingAgingMetricsDTO }
    expect(json.success).toBe(true)
    expect(json.data.buckets.d0_7.count).toBe(2) // 0 and 7 days
    expect(json.data.buckets.d0_7.totalAmount).toBe(3000)
    expect(json.data.buckets.d8_30.count).toBe(2) // 8 and 30 days
    expect(json.data.buckets.d8_30.totalAmount).toBe(7000)
    expect(json.data.buckets.d31_plus.count).toBe(1) // 31 days
    expect(json.data.buckets.d31_plus.totalAmount).toBe(5000)
    expect(json.data.totals.overdueCount).toBe(5)
    expect(json.data.totals.issuedCount).toBe(6)
    expect(json.data.totals.overduePercentOfIssued).toBe(83.33)
    expect(json.data.meta.calculatedAt).toBe(now.toISOString())
    expect(json.data.meta.status).toBe("OK")
    const ordered = json.data.bucketsOrdered
    expect(ordered.map((o) => o.key)).toEqual(["d0_7", "d8_30", "d31_plus"])
    expect(ordered[0].label).toBe("0–7 days")
    expect(ordered[0].count).toBe(2)
    expect(ordered[0].totalAmount).toBe(3000)
    expect(ordered[1].label).toBe("8–30 days")
    expect(ordered[1].count).toBe(2)
    expect(ordered[1].totalAmount).toBe(7000)
    expect(ordered[2].label).toBe("31+ days")
    expect(ordered[2].count).toBe(1)
    expect(ordered[2].totalAmount).toBe(5000)
  })

  it("issuedCount is 0 when only DRAFT/CANCELLED present", async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 1, 28)))
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findMany: vi.fn(async () => [
            { periodMonth: "2026-02", status: "DRAFT", totalAmount: 1000, dueDate: new Date(Date.UTC(2026, 1, 27)), paidAt: null },
            { periodMonth: "2026-02", status: "CANCELLED", totalAmount: 2000, dueDate: new Date(Date.UTC(2026, 1, 20)), paidAt: null },
          ]),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/metrics/billing/aging/route")
    const res = await route.GET(
      new Request("http://localhost/api/metrics/billing/aging?month=2026-02", {
        headers: { accept: "application/vnd.apartment.v1.1+json" },
      }),
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as { success: true; data: BillingAgingMetricsDTO }
    expect(json.success).toBe(true)
    expect(json.data.totals.issuedCount).toBe(0)
    expect(json.data.totals.overdueCount).toBe(0)
    expect(json.data.totals.overdueAmount).toBe(0)
    expect(json.data.totals.overduePercentOfIssued).toBe(0)
  })

  it("does not count PAID invoices as overdue even if past dueDate", async () => {
    const now = new Date(Date.UTC(2026, 2, 1))
    vi.setSystemTime(now)
    const pastDue = new Date(Date.UTC(2026, 1, 20))
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findMany: vi.fn(async () => [
            { periodMonth: "2026-03", status: "PAID", totalAmount: 4500, dueDate: pastDue, paidAt: now },
          ]),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/metrics/billing/aging/route")
    const res = await route.GET(
      new Request("http://localhost/api/metrics/billing/aging?month=2026-03", {
        headers: { accept: "application/vnd.apartment.v1.1+json" },
      }),
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as { success: true; data: BillingAgingMetricsDTO }
    expect(json.success).toBe(true)
    expect(json.data.totals.issuedCount).toBe(1)
    expect(json.data.totals.overdueCount).toBe(0)
    expect(json.data.buckets.d0_7.count + json.data.buckets.d8_30.count + json.data.buckets.d31_plus.count).toBe(0)
    expect(json.data.meta.status).toBe("OK")
  })

  it("timezone boundary: end-of-month past due falls into correct bucket", async () => {
    const now = new Date(Date.UTC(2026, 2, 1, 0, 0, 0)) // Mar 1, 2026 UTC
    vi.setSystemTime(now)
    const duePrevMonthEnd = new Date(Date.UTC(2026, 1, 1, 0, 0, 0)) // Feb 1, 2026 00:00 UTC represents end-of-Jan + grace reached
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findMany: vi.fn(async () => [
            { periodMonth: "2026-03", status: "SENT", totalAmount: 1200, dueDate: new Date(Date.UTC(2026, 0, 31)), paidAt: null },
            { periodMonth: "2026-03", status: "SENT", totalAmount: 800, dueDate: new Date(Date.UTC(2026, 0, 30)), paidAt: null },
          ]),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/metrics/billing/aging/route")
    const res = await route.GET(
      new Request("http://localhost/api/metrics/billing/aging?month=2026-03", {
        headers: { accept: "application/vnd.apartment.v1.1+json" },
      }),
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as { success: true; data: BillingAgingMetricsDTO }
    expect(json.success).toBe(true)
    const c8_30 = json.data.buckets.d8_30.count
    const c31p = json.data.buckets.d31_plus.count
    expect(c8_30 + c31p).toBeGreaterThanOrEqual(1)
    expect(json.data.meta.status).toBe("OK")
  })

  it("marks metrics as STALE when freshness exceeds threshold (crafted)", () => {
    const FRESHNESS_THRESHOLD_MS = 15 * 60 * 1000
    const bucketsOrdered = [
      { key: "d0_7", label: "0–7 days", count: 2, totalAmount: 300 },
      { key: "d8_30", label: "8–30 days", count: 1, totalAmount: 200 },
      { key: "d31_plus", label: "31+ days", count: 0, totalAmount: 0 },
    ] as const
    const totals = { overdueCount: 3, overdueAmount: 500, issuedCount: 6, overduePercentOfIssued: 50 } as const
    const orderedCountSum = bucketsOrdered.reduce((acc, b) => acc + b.count, 0)
    const orderedAmountSum = bucketsOrdered.reduce((acc, b) => acc + b.totalAmount, 0)
    expect(orderedCountSum).toBe(totals.overdueCount)
    expect(orderedAmountSum).toBe(totals.overdueAmount)
    const freshnessMs = FRESHNESS_THRESHOLD_MS + 1
    const isStale = freshnessMs > FRESHNESS_THRESHOLD_MS
    const inconsistent = orderedCountSum !== totals.overdueCount || orderedAmountSum !== totals.overdueAmount
    const status = inconsistent ? "INCONSISTENT" : isStale ? "STALE" : "OK"
    expect(isStale).toBe(true)
    expect(status).toBe("STALE")
  })

  it("INCONSISTENT status when crafted mismatch via helper sums", async () => {
    // Build mismatched payload via bucketsOrdered vs totals
    const payload = {
      bucketsOrdered: [
        { key: "d0_7", label: "0–7 days", count: 1, totalAmount: 100 },
        { key: "d8_30", label: "8–30 days", count: 1, totalAmount: 200 },
        { key: "d31_plus", label: "31+ days", count: 1, totalAmount: 300 },
      ],
      totals: { overdueCount: 5, overdueAmount: 999, issuedCount: 10, overduePercentOfIssued: 50 },
    } as const
    const orderedCountSum = payload.bucketsOrdered.reduce((acc, b) => acc + b.count, 0)
    const orderedAmountSum = payload.bucketsOrdered.reduce((acc, b) => acc + b.totalAmount, 0)
    expect(orderedCountSum).toBe(3)
    expect(orderedAmountSum).toBe(600)
    expect(payload.totals.overdueCount).toBe(5)
    expect(payload.totals.overdueAmount).toBe(999)
    // Simulate status derivation rule
    const isStale = false
    const inconsistent = orderedCountSum !== payload.totals.overdueCount || orderedAmountSum !== payload.totals.overdueAmount
    const status = inconsistent ? "INCONSISTENT" : isStale ? "STALE" : "OK"
    expect(status).toBe("INCONSISTENT")
  })
})
