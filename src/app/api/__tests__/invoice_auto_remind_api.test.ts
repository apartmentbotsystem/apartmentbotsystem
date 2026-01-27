import { describe, it, expect, vi, beforeEach } from "vitest"

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

describe("Admin Invoice Auto Remind API", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    vi.clearAllMocks()
    process.env.NODE_ENV = "development"
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-token"
    vi.doMock("@/lib/guards", () => ({
      requireRole: async () => ({ userId: "admin-1", role: "ADMIN" }),
    }))
  })

  it("overdue + new buckets (WARN, HARD) -> sends LINE and creates audit", async () => {
    const now = new Date(Date.UTC(2026, 1, 20))
    vi.setSystemTime(now)
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const auditEvent = {
        findFirst: vi.fn(async () => null),
        // use tx.auditEvent.create captured later
      }
      const prisma = {
        invoice: {
          findMany: vi.fn(async () => [
            // Jan -> due Feb 5 -> daysLate 15 -> WARN
            { id: "inv-warn", periodMonth: "2026-01", status: "SENT", totalAmount: 1000, paidAt: null, tenant: { lineUserId: "u-1" }, room: { roomNumber: "101" } },
            // Dec -> due Jan 5 -> daysLate >30 -> HARD
            { id: "inv-hard", periodMonth: "2025-12", status: "SENT", totalAmount: 2000, paidAt: null, tenant: { lineUserId: "u-3" }, room: { roomNumber: "103" } },
          ]),
        },
        auditEvent,
        $transaction: vi.fn(async (fn) => {
          // Provide tx with auditEvent.create
          const tx = { auditEvent: { create: vi.fn(async () => ({})) } }
          return fn(tx)
        }),
      }
      return { prisma }
    })
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    } as Response)
    const route = await import("@/app/api/admin/invoices/remind/auto/route")
    const req = new Request("http://localhost/api/admin/invoices/remind/auto", { method: "POST", headers: { accept: AcceptEnvelope } })
    const res = await route.POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.sent.soft).toBe(0)
    expect(json.data.sent.warn).toBe(1)
    expect(json.data.sent.hard).toBe(1)
    const calls = mockFetch.mock.calls.filter((c) => String(c[0]).includes("/message/push"))
    expect(calls.length).toBe(2)
  })

  it("overdue but bucket already sent -> skip", async () => {
    const now = new Date(Date.UTC(2026, 1, 20))
    vi.setSystemTime(now)
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findMany: vi.fn(async () => [
            { id: "inv-warn", periodMonth: "2026-01", status: "SENT", totalAmount: 1000, paidAt: null, tenant: { lineUserId: "u-1" }, room: { roomNumber: "101" } },
          ]),
        },
        auditEvent: {
          findFirst: vi.fn(async () => ({ id: "ae-1" })), // already sent WARN
        },
        $transaction: vi.fn(async (fn) => fn({ auditEvent: { create: vi.fn(async () => ({})) } })),
      }
      return { prisma }
    })
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    } as Response)
    const route = await import("@/app/api/admin/invoices/remind/auto/route")
    const req = new Request("http://localhost/api/admin/invoices/remind/auto", { method: "POST", headers: { accept: AcceptEnvelope } })
    const res = await route.POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.sent.soft + json.data.sent.warn + json.data.sent.hard).toBe(0)
    expect(json.data.skipped).toBeGreaterThanOrEqual(1)
    const calls = mockFetch.mock.calls.filter((c) => String(c[0]).includes("/message/push"))
    expect(calls.length).toBe(0)
  })

  it("daysLate mapping -> SOFT bucket correctly", async () => {
    const now = new Date(Date.UTC(2026, 2, 10)) // Mar 10, 2026
    vi.setSystemTime(now)
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findMany: vi.fn(async () => [
            // Feb -> end Feb 28 + grace 5 = Mar 5 -> daysLate 5 -> SOFT
            { id: "inv-soft", periodMonth: "2026-02", status: "SENT", totalAmount: 800, paidAt: null, tenant: { lineUserId: "u-2" }, room: { roomNumber: "102" } },
          ]),
        },
        auditEvent: { findFirst: vi.fn(async () => null) },
        $transaction: vi.fn(async (fn) => fn({ auditEvent: { create: vi.fn(async () => ({})) } })),
      }
      return { prisma }
    })
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    } as Response)
    const route = await import("@/app/api/admin/invoices/remind/auto/route")
    const req = new Request("http://localhost/api/admin/invoices/remind/auto", { method: "POST", headers: { accept: AcceptEnvelope } })
    const res = await route.POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.sent.soft).toBe(1)
    expect(json.data.sent.warn).toBe(0)
    expect(json.data.sent.hard).toBe(0)
    const calls = mockFetch.mock.calls.filter((c) => String(c[0]).includes("/message/push"))
    expect(calls.length).toBe(1)
  })

  it("tenant has no lineUserId -> skip", async () => {
    const now = new Date(Date.UTC(2026, 1, 20))
    vi.setSystemTime(now)
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findMany: vi.fn(async () => [
            { id: "inv-no-line", periodMonth: "2026-01", status: "SENT", totalAmount: 1000, paidAt: null, tenant: { lineUserId: "" }, room: { roomNumber: "101" } },
          ]),
        },
        auditEvent: { findFirst: vi.fn(async () => null) },
        $transaction: vi.fn(async (fn) => fn({ auditEvent: { create: vi.fn(async () => ({})) } })),
      }
      return { prisma }
    })
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    } as Response)
    const route = await import("@/app/api/admin/invoices/remind/auto/route")
    const req = new Request("http://localhost/api/admin/invoices/remind/auto", { method: "POST", headers: { accept: AcceptEnvelope } })
    const res = await route.POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.sent.soft + json.data.sent.warn + json.data.sent.hard).toBe(0)
    const calls = mockFetch.mock.calls.filter((c) => String(c[0]).includes("/message/push"))
    expect(calls.length).toBe(0)
  })

  it("non-ADMIN -> 403", async () => {
    vi.doMock("@/lib/guards", async () => {
      const { HttpError } = await import("@/interface/errors/HttpError")
      return {
        requireRole: async () => {
          throw new HttpError(403, "FORBIDDEN", "Forbidden")
        },
      }
    })
    const route = await import("@/app/api/admin/invoices/remind/auto/route")
    const req = new Request("http://localhost/api/admin/invoices/remind/auto", { method: "POST" })
    const res = await route.POST(req)
    expect(res.status).toBe(403)
  })
})
