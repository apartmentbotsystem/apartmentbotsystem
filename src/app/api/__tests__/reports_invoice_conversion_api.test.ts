import { describe, it, expect, vi, beforeEach } from "vitest"
import { InvoiceConversionSummaryDTO } from "@/interface/validators/report.schema"

function makeReq(url: string, init?: RequestInit, headers?: Record<string, string>) {
  const h = new Headers(init?.headers || {})
  if (headers) for (const [k, v] of Object.entries(headers)) h.set(k, v)
  return new Request(url, { ...init, headers: h })
}

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

describe("Invoice Conversion Summary API (read-only)", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doMock("@/lib/guards", () => ({
      requireRole: async () => ({ userId: "admin-1", role: "ADMIN" }),
    }))
  })

  it("computes conversion rate and unpaid aging buckets without mutation", async () => {
    const now = new Date(Date.UTC(2026, 0, 20))
    vi.setSystemTime(now)
    const sent7 = new Date(Date.UTC(2026, 0, 15))
    const sent10 = new Date(Date.UTC(2026, 0, 10))
    const sent20 = new Date(Date.UTC(2026, 0, 0 + 1)) // Jan 1
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findMany: vi.fn(async ({ where }: { where: { periodMonth: string } }) =>
            where.periodMonth === "2026-01"
              ? [
                  { id: "inv-1", periodMonth: "2026-01", status: "DRAFT", totalAmount: 1000, issuedAt: new Date(Date.UTC(2026, 0, 5)) },
                  { id: "inv-2", periodMonth: "2026-01", status: "PAID", totalAmount: 2000, issuedAt: new Date(Date.UTC(2026, 0, 8)), paidAt: new Date(Date.UTC(2026, 0, 12)) },
                  { id: "inv-3", periodMonth: "2026-01", status: "SENT", totalAmount: 3000, sentAt: sent7 },
                  { id: "inv-4", periodMonth: "2026-01", status: "SENT", totalAmount: 4000, sentAt: sent10 },
                  { id: "inv-5", periodMonth: "2026-01", status: "SENT", totalAmount: 5000, sentAt: sent20 },
                ]
              : [],
          ),
          create: vi.fn(async () => ({})),
          update: vi.fn(async () => ({})),
          delete: vi.fn(async () => ({})),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/reports/invoices/conversion/route")
    const req = makeReq("http://localhost/api/admin/reports/invoices/conversion?period=2026-01", { method: "GET" }, { accept: AcceptEnvelope })
    const res = await route.GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    InvoiceConversionSummaryDTO.parse(json.data)
    // issued = 5 (DRAFT + PAID + SENT x3), paid = 1 -> conversionRate = 0.2
    expect(json.data.issuedCount).toBe(5)
    expect(json.data.paidCount).toBe(1)
    expect(json.data.conversionRate).toBeCloseTo(0.2, 5)
    // buckets: sent7 -> d0_7, sent10 -> d8_14, sent20 -> d15_30
    expect(json.data.unpaidAgingBuckets.d0_7).toBe(1)
    expect(json.data.unpaidAgingBuckets.d8_14).toBe(1)
    expect(json.data.unpaidAgingBuckets.d15_30).toBe(1)
    expect(json.data.unpaidAgingBuckets.d31_plus).toBe(0)
    const { prisma } = await import("@/infrastructure/db/prisma/prismaClient")
    expect(((prisma.invoice.create as unknown) as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0)
    expect(((prisma.invoice.update as unknown) as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0)
    expect(((prisma.invoice.delete as unknown) as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0)
  })

  it("determinism: same input returns same output", async () => {
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const base = [
        { id: "inv-a", periodMonth: "2026-02", status: "PAID", totalAmount: 1000, issuedAt: new Date(Date.UTC(2026, 1, 1)), paidAt: new Date(Date.UTC(2026, 1, 3)) },
        { id: "inv-b", periodMonth: "2026-02", status: "SENT", totalAmount: 2000, sentAt: new Date(Date.UTC(2026, 1, 10)) },
      ]
      const prisma = {
        invoice: {
          findMany: vi.fn(async ({ where }: { where: { periodMonth: string } }) => base.filter((r) => r.periodMonth === where.periodMonth)),
          create: vi.fn(async () => ({})),
          update: vi.fn(async () => ({})),
          delete: vi.fn(async () => ({})),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/reports/invoices/conversion/route")
    const req = makeReq("http://localhost/api/admin/reports/invoices/conversion?period=2026-02", { method: "GET" }, { accept: AcceptEnvelope })
    const res1 = await route.GET(req)
    const res2 = await route.GET(req)
    const j1 = await res1.json()
    const j2 = await res2.json()
    InvoiceConversionSummaryDTO.parse(j1.data)
    InvoiceConversionSummaryDTO.parse(j2.data)
    expect(JSON.stringify(j1.data)).toBe(JSON.stringify(j2.data))
  })
})
