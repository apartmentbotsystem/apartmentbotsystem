import { describe, it, expect, vi, beforeEach } from "vitest"
import { MonthlyInvoiceSummaryDTO } from "@/interface/validators/report.schema"

function makeReq(url: string, init?: RequestInit, headers?: Record<string, string>) {
  const h = new Headers(init?.headers || {})
  if (headers) for (const [k, v] of Object.entries(headers)) h.set(k, v)
  return new Request(url, { ...init, headers: h })
}

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

describe("Monthly Invoice Summary API (read-only)", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doMock("@/lib/guards", () => ({
      requireRole: async () => ({ userId: "admin-1", role: "ADMIN" }),
    }))
  })

  it("returns aggregated summary and does not mutate DB", async () => {
    const rows: Array<Record<string, unknown>> = [
      { id: "inv-1", periodMonth: "2026-01", status: "DRAFT", totalAmount: 1000 },
      { id: "inv-2", periodMonth: "2026-01", status: "SENT", totalAmount: 2000 },
      { id: "inv-3", periodMonth: "2026-01", status: "PAID", totalAmount: 3000, paidAt: new Date() },
      { id: "inv-4", periodMonth: "2026-01", status: "SENT", totalAmount: 4000 },
    ]
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findMany: vi.fn(async ({ where }: { where: { periodMonth: string } }) => rows.filter((r) => r.periodMonth === where.periodMonth)),
          create: vi.fn(async () => ({})),
          update: vi.fn(async () => ({})),
          delete: vi.fn(async () => ({})),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/reports/invoices/monthly/route")
    const req = makeReq("http://localhost/api/admin/reports/invoices/monthly?period=2026-01", { method: "GET" }, { accept: AcceptEnvelope })
    const res = await route.GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    MonthlyInvoiceSummaryDTO.parse(json.data)
    expect(json.data.totals.issued).toBe(4)
    expect(json.data.totals.sent).toBe(2)
    expect(json.data.totals.paid).toBe(1)
    expect(json.data.totals.unpaid).toBe(2)
    expect(json.data.amounts.paidTotal).toBe(3000)
    expect(json.data.amounts.unpaidTotal).toBe(6000)
    const { prisma } = await import("@/infrastructure/db/prisma/prismaClient")
    expect(((prisma.invoice.create as unknown) as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0)
    expect(((prisma.invoice.update as unknown) as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0)
    expect(((prisma.invoice.delete as unknown) as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0)
  })

  it("consistency: same input returns same output", async () => {
    const rows: Array<Record<string, unknown>> = [
      { id: "inv-1", periodMonth: "2026-02", status: "SENT", totalAmount: 1000 },
      { id: "inv-2", periodMonth: "2026-02", status: "PAID", totalAmount: 2000, paidAt: new Date() },
    ]
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findMany: vi.fn(async ({ where }: { where: { periodMonth: string } }) => rows.filter((r) => r.periodMonth === where.periodMonth)),
          create: vi.fn(async () => ({})),
          update: vi.fn(async () => ({})),
          delete: vi.fn(async () => ({})),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/reports/invoices/monthly/route")
    const req = makeReq("http://localhost/api/admin/reports/invoices/monthly?period=2026-02", { method: "GET" }, { accept: AcceptEnvelope })
    const res1 = await route.GET(req)
    const res2 = await route.GET(req)
    const j1 = await res1.json()
    const j2 = await res2.json()
    MonthlyInvoiceSummaryDTO.parse(j1.data)
    MonthlyInvoiceSummaryDTO.parse(j2.data)
    expect(JSON.stringify(j1.data)).toBe(JSON.stringify(j2.data))
  })
})
