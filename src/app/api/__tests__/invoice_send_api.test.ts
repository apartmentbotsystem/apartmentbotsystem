import { describe, it, expect, vi, beforeEach } from "vitest"

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

vi.mock("@/lib/guards", () => ({
  requireRole: async () => ({ userId: "admin-1", role: "ADMIN" }),
}))

describe("Admin Invoice Send API", () => {
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

  it("sends invoice: transitions DRAFT -> SENT and sets sentAt", async () => {
    const updates: Array<Record<string, unknown>> = []
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const invoiceRow = {
        id: "inv-1",
        tenantId: "tenant-1",
        roomId: "room-1",
        periodMonth: "2026-01",
        rentAmount: 5000,
        waterAmount: 0,
        electricAmount: 0,
        totalAmount: 5000,
        status: "DRAFT",
        issuedAt: new Date(),
        dueDate: new Date(),
        tenant: { id: "tenant-1", name: "John Doe", lineUserId: "u-123" },
        room: { id: "room-1", roomNumber: "101" },
      }
      const prisma = {
        invoice: {
          findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === "inv-1" ? invoiceRow : null)),
          update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            updates.push({ where, data })
            return { ...invoiceRow, ...data }
          }),
        },
        adminAuditLog: {
          create: vi.fn(async () => ({})),
        },
        $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => {
          return fn(prisma as unknown)
        }),
      }
      return { prisma }
    })
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    } as Response)
    const route = await import("@/app/api/admin/invoices/[id]/send/route")
    const req = new Request("http://localhost/api/admin/invoices/inv-1/send", { method: "POST", headers: { accept: AcceptEnvelope } })
    const res = await route.POST(req, { params: Promise.resolve({ id: "inv-1" }) })
    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalled()
    const args = mockFetch.mock.calls[0]
    const body = (args[1] as RequestInit).body
    expect(body instanceof FormData).toBe(true)
    expect(updates.length).toBe(1)
    const data = updates[0].data as { status: string; sentAt: Date }
    expect(data.status).toBe("SENT")
    expect(data.sentAt instanceof Date).toBe(true)
    const prismaMod = await import("@/infrastructure/db/prisma/prismaClient")
    const adminCreate = (prismaMod.prisma as unknown as { adminAuditLog: { create: { mock: { calls: unknown[][] } } } }).adminAuditLog.create
    expect(adminCreate.mock.calls.length).toBe(1)
  })

  it("rejects non-DRAFT invoice", async () => {
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findUnique: vi.fn(async () => ({
            id: "inv-2",
            tenantId: "tenant-1",
            roomId: "room-1",
            periodMonth: "2026-01",
            rentAmount: 5000,
            waterAmount: 0,
            electricAmount: 0,
            totalAmount: 5000,
            status: "SENT",
            issuedAt: new Date(),
            dueDate: new Date(),
            tenant: { id: "tenant-1", name: "John Doe", lineUserId: "u-123" },
            room: { id: "room-1", roomNumber: "101" },
          })),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/invoices/[id]/send/route")
    const req = new Request("http://localhost/api/admin/invoices/inv-2/send", { method: "POST", headers: { accept: AcceptEnvelope } })
    const res = await route.POST(req, { params: Promise.resolve({ id: "inv-2" }) })
    expect(res.status).toBe(400)
  })

  it("rejects non-ADMIN with 403", async () => {
    vi.doMock("@/lib/guards", async () => {
      const { HttpError } = await import("@/interface/errors/HttpError")
      return {
        requireRole: async () => {
          throw new HttpError(403, "FORBIDDEN", "Forbidden")
        },
      }
    })
    const route = await import("@/app/api/admin/invoices/[id]/send/route")
    const req = new Request("http://localhost/api/admin/invoices/inv-2/send", { method: "POST", headers: { accept: AcceptEnvelope } })
    const res = await route.POST(req, { params: Promise.resolve({ id: "inv-2" }) })
    expect(res.status).toBe(403)
  })
  it("rejects when tenant has no LINE id", async () => {
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findUnique: vi.fn(async () => ({
            id: "inv-3",
            tenantId: "tenant-1",
            roomId: "room-1",
            periodMonth: "2026-01",
            rentAmount: 5000,
            waterAmount: 0,
            electricAmount: 0,
            totalAmount: 5000,
            status: "DRAFT",
            issuedAt: new Date(),
            dueDate: new Date(),
            tenant: { id: "tenant-1", name: "John Doe", lineUserId: "" },
            room: { id: "room-1", roomNumber: "101" },
          })),
        },
        adminAuditLog: {
          create: vi.fn(async () => ({})),
        },
        $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => {
          return fn(prisma as unknown)
        }),
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/invoices/[id]/send/route")
    const req = new Request("http://localhost/api/admin/invoices/inv-3/send", { method: "POST", headers: { accept: AcceptEnvelope } })
    const res = await route.POST(req, { params: Promise.resolve({ id: "inv-3" }) })
    const body = await res.json().catch(() => null)
    if (res.status !== 400) {
      console.error("Debug invoice_send_api tenant no LINE id:", { status: res.status, body })
    }
    expect(res.status).toBe(400)
  })

  it("idempotency key returns cached response and avoids duplicate upload", async () => {
    const updates: Array<Record<string, unknown>> = []
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const invoiceRow = {
        id: "inv-10",
        tenantId: "tenant-10",
        roomId: "room-10",
        periodMonth: "2026-03",
        rentAmount: 5000,
        waterAmount: 0,
        electricAmount: 0,
        totalAmount: 5000,
        status: "DRAFT",
        issuedAt: new Date(),
        dueDate: new Date(),
        tenant: { id: "tenant-10", name: "Jane", lineUserId: "u-999" },
        room: { id: "room-10", roomNumber: "305" },
      }
      const store: Array<{ key: string; endpoint: string; requestHash: string; responseSnapshot: unknown }> = []
      const prisma = {
        invoice: {
          findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === "inv-10" ? invoiceRow : null)),
          update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            updates.push({ where, data })
            return { ...invoiceRow, ...data }
          }),
        },
        adminAuditLog: {
          create: vi.fn(async () => ({})),
        },
        idempotencyKey: {
          findFirst: vi.fn(async ({ where }: { where: { key: string; endpoint: string } }) =>
            store.find((x) => x.key === where.key && x.endpoint === where.endpoint) ?? null,
          ),
          create: vi.fn(async ({ data }: { data: { key: string; endpoint: string; requestHash: string; responseSnapshot: unknown } }) => {
            store.push({ ...data })
            return { id: `k${store.length}`, ...data }
          }),
        },
        $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => {
          return fn(prisma as unknown)
        }),
      }
      return { prisma }
    })
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    } as Response)
    const route = await import("@/app/api/admin/invoices/[id]/send/route")
    const req1 = new Request("http://localhost/api/admin/invoices/inv-10/send", {
      method: "POST",
      headers: { accept: AcceptEnvelope, "x-idempotency-key": "key-send-1" },
    })
    const res1 = await route.POST(req1, { params: Promise.resolve({ id: "inv-10" }) })
    expect(res1.status).toBe(200)
    const req2 = new Request("http://localhost/api/admin/invoices/inv-10/send", {
      method: "POST",
      headers: { accept: AcceptEnvelope, "x-idempotency-key": "key-send-1" },
    })
    const res2 = await route.POST(req2, { params: Promise.resolve({ id: "inv-10" }) })
    expect(res2.status).toBe(200)
    expect(mockFetch.mock.calls.length).toBe(1)
  })
})
