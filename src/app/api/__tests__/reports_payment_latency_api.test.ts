import { describe, it, expect, vi, beforeEach } from "vitest"
import { PaymentLatencyStatsDTO } from "@/interface/validators/report.schema"

function makeReq(url: string, init?: RequestInit, headers?: Record<string, string>) {
  const h = new Headers(init?.headers || {})
  if (headers) for (const [k, v] of Object.entries(headers)) h.set(k, v)
  return new Request(url, { ...init, headers: h })
}

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

describe("Payment Latency Stats API (read-only)", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doMock("@/lib/guards", () => ({
      requireRole: async () => ({ userId: "admin-1", role: "ADMIN" }),
    }))
  })

  it("computes latency stats and does not mutate DB", async () => {
    const issued1 = new Date(Date.UTC(2026, 0, 1))
    const paid1 = new Date(Date.UTC(2026, 0, 6))
    const issued2 = new Date(Date.UTC(2026, 0, 10))
    const paid2 = new Date(Date.UTC(2026, 0, 12))
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findMany: vi.fn(async () => [
            { id: "inv-1", periodMonth: "2026-01", status: "PAID", issuedAt: issued1, paidAt: paid1, totalAmount: 1000 },
            { id: "inv-2", periodMonth: "2026-01", status: "PAID", issuedAt: issued2, paidAt: paid2, totalAmount: 2000 },
          ]),
          create: vi.fn(async () => ({})),
          update: vi.fn(async () => ({})),
          delete: vi.fn(async () => ({})),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/reports/payments/latency/route")
    const req = makeReq("http://localhost/api/admin/reports/payments/latency?period=2026-01", { method: "GET" }, { accept: AcceptEnvelope })
    const res = await route.GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    PaymentLatencyStatsDTO.parse(json.data)
    expect(json.data.latencyDays.median).toBe(5)
    expect(json.data.latencyDays.avg).toBeGreaterThan(0)
    expect(json.data.latencyDays.p95).toBeGreaterThan(0)
    const { prisma } = await import("@/infrastructure/db/prisma/prismaClient")
    expect(((prisma.invoice.create as unknown) as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0)
    expect(((prisma.invoice.update as unknown) as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0)
    expect(((prisma.invoice.delete as unknown) as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0)
  })

  it("consistency: same input returns same output", async () => {
    const issued = new Date(Date.UTC(2026, 1, 1))
    const paid = new Date(Date.UTC(2026, 1, 3))
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findMany: vi.fn(async () => [{ id: "inv-10", periodMonth: "2026-02", status: "PAID", issuedAt: issued, paidAt: paid, totalAmount: 1000 }]),
          create: vi.fn(async () => ({})),
          update: vi.fn(async () => ({})),
          delete: vi.fn(async () => ({})),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/reports/payments/latency/route")
    const req = makeReq("http://localhost/api/admin/reports/payments/latency?period=2026-02", { method: "GET" }, { accept: AcceptEnvelope })
    const res1 = await route.GET(req)
    const res2 = await route.GET(req)
    const j1 = await res1.json()
    const j2 = await res2.json()
    PaymentLatencyStatsDTO.parse(j1.data)
    PaymentLatencyStatsDTO.parse(j2.data)
    expect(JSON.stringify(j1.data)).toBe(JSON.stringify(j2.data))
  })
})
