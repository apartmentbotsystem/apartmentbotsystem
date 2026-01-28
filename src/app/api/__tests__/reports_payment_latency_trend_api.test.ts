import { describe, it, expect, vi, beforeEach } from "vitest"
import { PaymentLatencyTrendDTO } from "@/interface/validators/report.schema"

function makeReq(url: string, init?: RequestInit, headers?: Record<string, string>) {
  const h = new Headers(init?.headers || {})
  if (headers) for (const [k, v] of Object.entries(headers)) h.set(k, v)
  return new Request(url, { ...init, headers: h })
}

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

describe("Payment Latency Trend API (read-only)", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doMock("@/lib/guards", () => ({
      requireRole: async () => ({ userId: "admin-1", role: "ADMIN" }),
    }))
  })

  it("computes trend UP/DOWN/FLAT and does not mutate DB", async () => {
    const issuedPrev = new Date(Date.UTC(2026, 0, 1))
    const paidPrev = new Date(Date.UTC(2026, 0, 6)) // 5 days
    const issuedCur = new Date(Date.UTC(2026, 1, 1))
    const paidCur = new Date(Date.UTC(2026, 1, 4)) // 3 days
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findMany: vi.fn(async ({ where }: { where: { periodMonth: string; status?: string } }) => {
            if (where.periodMonth === "2026-02") {
              return [{ id: "inv-cur", periodMonth: "2026-02", status: "PAID", issuedAt: issuedCur, paidAt: paidCur }]
            }
            if (where.periodMonth === "2026-01") {
              return [{ id: "inv-prev", periodMonth: "2026-01", status: "PAID", issuedAt: issuedPrev, paidAt: paidPrev }]
            }
            return []
          }),
          create: vi.fn(async () => ({})),
          update: vi.fn(async () => ({})),
          delete: vi.fn(async () => ({})),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/reports/payments/latency-trend/route")
    const req = makeReq("http://localhost/api/admin/reports/payments/latency-trend?period=2026-02", { method: "GET" }, { accept: AcceptEnvelope })
    const res = await route.GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    PaymentLatencyTrendDTO.parse(json.data)
    expect(json.data.trendDirection).toBe("DOWN")
    const { prisma } = await import("@/infrastructure/db/prisma/prismaClient")
    expect(((prisma.invoice.create as unknown) as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0)
    expect(((prisma.invoice.update as unknown) as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0)
    expect(((prisma.invoice.delete as unknown) as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0)
  })

  it("determinism: same input returns same output", async () => {
    const issuedPrev = new Date(Date.UTC(2026, 2, 1))
    const paidPrev = new Date(Date.UTC(2026, 2, 2)) // 1 day
    const issuedCur = new Date(Date.UTC(2026, 3, 1))
    const paidCur = new Date(Date.UTC(2026, 3, 3)) // 2 days
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findMany: vi.fn(async ({ where }: { where: { periodMonth: string; status?: string } }) => {
            if (where.periodMonth === "2026-04") {
              return [{ id: "inv-cur", periodMonth: "2026-04", status: "PAID", issuedAt: issuedCur, paidAt: paidCur }]
            }
            if (where.periodMonth === "2026-03") {
              return [{ id: "inv-prev", periodMonth: "2026-03", status: "PAID", issuedAt: issuedPrev, paidAt: paidPrev }]
            }
            return []
          }),
          create: vi.fn(async () => ({})),
          update: vi.fn(async () => ({})),
          delete: vi.fn(async () => ({})),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/reports/payments/latency-trend/route")
    const req = makeReq("http://localhost/api/admin/reports/payments/latency-trend?period=2026-04", { method: "GET" }, { accept: AcceptEnvelope })
    const res1 = await route.GET(req)
    const res2 = await route.GET(req)
    const j1 = await res1.json()
    const j2 = await res2.json()
    PaymentLatencyTrendDTO.parse(j1.data)
    PaymentLatencyTrendDTO.parse(j2.data)
    expect(JSON.stringify(j1.data)).toBe(JSON.stringify(j2.data))
  })
})
