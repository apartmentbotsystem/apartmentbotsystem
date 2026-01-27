import { describe, it, expect, vi, beforeEach } from "vitest"

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

describe("Admin Invoice Remind API", () => {
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

  it("overdue + lineUserId -> success, sends LINE and creates audit", async () => {
    const now = new Date(Date.UTC(2026, 1, 10))
    vi.setSystemTime(now)
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findUnique: vi.fn(async () => ({
            id: "inv-overdue",
            tenantId: "t1",
            roomId: "r1",
            periodMonth: "2026-01",
            rentAmount: 5000,
            totalAmount: 5000,
            status: "SENT",
            paidAt: null,
            tenant: { id: "t1", name: "Alice", lineUserId: "u-123" },
            room: { id: "r1", roomNumber: "301" },
          })),
        },
        auditEvent: {
          findFirst: vi.fn(async () => null),
          create: vi.fn(async () => ({})),
        },
      }
      return { prisma }
    })
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    } as Response)
    const route = await import("@/app/api/admin/invoices/[id]/remind/route")
    const req = new Request("http://localhost/api/admin/invoices/inv-overdue/remind", { method: "POST", headers: { accept: AcceptEnvelope } })
    const res = await route.POST(req, { params: Promise.resolve({ id: "inv-overdue" }) })
    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalled()
    const calls = mockFetch.mock.calls.filter((c) => String(c[0]).includes("/message/push"))
    expect(calls.length).toBeGreaterThan(0)
    const { prisma } = await import("@/infrastructure/db/prisma/prismaClient")
    const auditCreate = prisma.auditEvent.create as unknown as ReturnType<typeof vi.fn>
    expect(auditCreate.mock.calls.length).toBe(1)
  })

  it("not overdue -> 400 NOT_OVERDUE", async () => {
    const now = new Date(Date.UTC(2026, 1, 3))
    vi.setSystemTime(now)
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findUnique: vi.fn(async () => ({
            id: "inv-not-overdue",
            tenantId: "t1",
            roomId: "r1",
            periodMonth: "2026-01",
            rentAmount: 5000,
            totalAmount: 5000,
            status: "SENT",
            paidAt: null,
            tenant: { id: "t1", name: "Alice", lineUserId: "u-123" },
            room: { id: "r1", roomNumber: "301" },
          })),
        },
        auditEvent: {
          findFirst: vi.fn(async () => null),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/invoices/[id]/remind/route")
    const req = new Request("http://localhost/api/admin/invoices/inv-not-overdue/remind", { method: "POST", headers: { accept: AcceptEnvelope } })
    const res = await route.POST(req, { params: Promise.resolve({ id: "inv-not-overdue" }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe("NOT_OVERDUE")
  })

  it("no lineUserId -> 400 TENANT_LINE_NOT_BOUND", async () => {
    const now = new Date(Date.UTC(2026, 1, 10))
    vi.setSystemTime(now)
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findUnique: vi.fn(async () => ({
            id: "inv-no-line",
            tenantId: "t1",
            roomId: "r1",
            periodMonth: "2026-01",
            rentAmount: 5000,
            totalAmount: 5000,
            status: "SENT",
            paidAt: null,
            tenant: { id: "t1", name: "Alice", lineUserId: "" },
            room: { id: "r1", roomNumber: "301" },
          })),
        },
        auditEvent: {
          findFirst: vi.fn(async () => null),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/invoices/[id]/remind/route")
    const req = new Request("http://localhost/api/admin/invoices/inv-no-line/remind", { method: "POST", headers: { accept: AcceptEnvelope } })
    const res = await route.POST(req, { params: Promise.resolve({ id: "inv-no-line" }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe("TENANT_LINE_NOT_BOUND")
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
    const route = await import("@/app/api/admin/invoices/[id]/remind/route")
    const req = new Request("http://localhost/api/admin/invoices/inv-overdue/remind", { method: "POST", headers: { accept: AcceptEnvelope } })
    const res = await route.POST(req, { params: Promise.resolve({ id: "inv-overdue" }) })
    expect(res.status).toBe(403)
  })

  it("paid invoice cannot be reminded", async () => {
    const now = new Date(Date.UTC(2026, 1, 10))
    vi.setSystemTime(now)
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findUnique: vi.fn(async () => ({
            id: "inv-paid",
            tenantId: "t1",
            roomId: "r1",
            periodMonth: "2026-01",
            rentAmount: 5000,
            totalAmount: 5000,
            status: "PAID",
            paidAt: new Date(Date.UTC(2026, 1, 1)),
            tenant: { id: "t1", name: "Alice", lineUserId: "u-123" },
            room: { id: "r1", roomNumber: "301" },
          })),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/invoices/[id]/remind/route")
    const req = new Request("http://localhost/api/admin/invoices/inv-paid/remind", { method: "POST", headers: { accept: AcceptEnvelope } })
    const res = await route.POST(req, { params: Promise.resolve({ id: "inv-paid" }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe("NOT_OVERDUE")
  })
})
