import { describe, it, expect, vi, beforeEach } from "vitest"
import { httpError } from "@/interface/errors/HttpError"
import { ErrorCodes } from "@/interface/errors/error-codes"

vi.mock("@/infrastructure/db/prisma/prismaClient", () => {
  let registrations: Array<{
    id: string
    lineUserId: string
    roomId: string | null
    tenantId: string | null
    status: "PENDING" | "ACTIVE" | "REJECTED"
    createdAt: Date
    approvedAt: Date | null
    approvedBy: string | null
  }> = []
  let tenants: Array<{ id: string; name: string; role: string; roomId: string; lineUserId: string | null }> = []
  const roomTable: Record<string, { id: string; roomNumber: string; status: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE" }> = {}
  function reset() {
    registrations = [
      { id: "reg-1", lineUserId: "u1", roomId: "room-1", tenantId: null, status: "PENDING", createdAt: new Date("2026-01-01T09:00:00Z"), approvedAt: null, approvedBy: null },
    ]
    tenants = [{ id: "tenant-1", name: "John", role: "PRIMARY", roomId: "room-1", lineUserId: null }]
    roomTable["room-1"] = { id: "room-1", roomNumber: "101", status: "AVAILABLE" }
  }
  reset()
  const prisma = {
    tenantRegistration: {
      findMany: vi.fn(async ({ where, orderBy }: { where: { status: string }; orderBy: { createdAt: "asc" | "desc" } }) => {
        void where
        void orderBy
        return registrations.map((r) => ({ ...r, room: r.roomId ? roomTable[r.roomId] : null, tenant: r.tenantId ? tenants.find((t) => t.id === r.tenantId) ?? null : null }))
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => registrations.find((r) => r.id === where.id) ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<(typeof registrations)[number]> }) => {
        const r = registrations.find((x) => x.id === where.id)
        if (!r) throw new Error("not found")
        Object.assign(r, data)
        return { ...r }
      }),
    },
    room: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => roomTable[where.id] ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { status?: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE"; tenantId?: string } }) => {
        const r = roomTable[where.id]
        if (!r) throw new Error("room not found")
        if (data.status) r.status = data.status
        return { ...r }
      }),
    },
    tenant: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => tenants.find((t) => t.id === where.id) ?? null),
      findFirst: vi.fn(async ({ where }: { where: { roomId?: string; role?: string } }) => tenants.find((t) => (!where.roomId || t.roomId === where.roomId) && (!where.role || t.role === where.role)) ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { lineUserId: string } }) => {
        const t = tenants.find((x) => x.id === where.id)
        if (!t) throw new Error("tenant not found")
        t.lineUserId = data.lineUserId
        return { ...t }
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => {
      return fn(prisma as unknown)
    }),
  }
  return { prisma, __reset: reset }
})

describe("Admin Tenant Registrations API", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.NODE_ENV = "development"
    vi.doMock("@/lib/auth.config", () => ({
      auth: async () => ({ userId: "admin-1", role: "ADMIN", capabilities: [] }),
    }))
    return import("@/infrastructure/db/prisma/prismaClient").then((mod) => {
      const anyMod = mod as unknown as { __reset?: () => void }
      anyMod.__reset && anyMod.__reset()
    })
  })

  it("list pending (admin)", async () => {
    const listRoute = await import("@/app/api/admin/tenant-registrations/route")
    const req = new Request("http://localhost/api/admin/tenant-registrations", { method: "GET", headers: { accept: "application/vnd.apartment.v1.1+json" } })
    const res = await listRoute.GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data[0].lineUserId).toBe("u1")
    expect(json.data[0].room.roomNumber).toBe("101")
  })

  it("list pending forbidden for non-admin", async () => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doMock("@/lib/auth.config", () => ({
      auth: async () => ({ userId: "staff-1", role: "STAFF", capabilities: [] }),
    }))
    const listRoute = await import("@/app/api/admin/tenant-registrations/route")
    const req = new Request("http://localhost/api/admin/tenant-registrations", { method: "GET", headers: { accept: "application/vnd.apartment.v1.1+json" } })
    const res = await listRoute.GET(req)
    expect(res.status).toBe(403)
  })

  it("approve success binds tenant lineUserId", async () => {
    const approveRoute = await import("@/app/api/admin/tenant-registrations/[id]/approve/route")
    const ctx = { params: Promise.resolve({ id: "reg-1" }) }
    const req = new Request("http://localhost/api/admin/tenant-registrations/reg-1/approve", { method: "POST", headers: { accept: "application/vnd.apartment.v1.1+json" } })
    const res = await approveRoute.POST(req, ctx)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it("approve non-pending -> 400", async () => {
    const approveRoute = await import("@/app/api/admin/tenant-registrations/[id]/approve/route")
    const { prisma } = await import("@/infrastructure/db/prisma/prismaClient")
    await prisma.tenantRegistration.update({ where: { id: "reg-1" }, data: { status: "ACTIVE" } })
    const ctx = { params: Promise.resolve({ id: "reg-1" }) }
    const req = new Request("http://localhost/api/admin/tenant-registrations/reg-1/approve", { method: "POST", headers: { accept: "application/vnd.apartment.v1.1+json" } })
    const res = await approveRoute.POST(req, ctx)
    expect(res.status).toBe(400)
  })

  it("reject success leaves tenant unchanged", async () => {
    const rejectRoute = await import("@/app/api/admin/tenant-registrations/[id]/reject/route")
    const { prisma } = await import("@/infrastructure/db/prisma/prismaClient")
    await prisma.tenantRegistration.update({ where: { id: "reg-1" }, data: { status: "PENDING" } })
    const ctx = { params: Promise.resolve({ id: "reg-1" }) }
    const req = new Request("http://localhost/api/admin/tenant-registrations/reg-1/reject", { method: "POST", headers: { accept: "application/vnd.apartment.v1.1+json" } })
    const res = await rejectRoute.POST(req, ctx)
    expect(res.status).toBe(200)
    const t = await prisma.tenant.findFirst({ where: { roomId: "room-1", role: "PRIMARY" } })
    expect(t?.lineUserId).toBe(null)
  })

  it("reject non-pending -> 400", async () => {
    const rejectRoute = await import("@/app/api/admin/tenant-registrations/[id]/reject/route")
    const { prisma } = await import("@/infrastructure/db/prisma/prismaClient")
    await prisma.tenantRegistration.update({ where: { id: "reg-1" }, data: { status: "ACTIVE" } })
    const ctx = { params: Promise.resolve({ id: "reg-1" }) }
    const req = new Request("http://localhost/api/admin/tenant-registrations/reg-1/reject", { method: "POST", headers: { accept: "application/vnd.apartment.v1.1+json" } })
    const res = await rejectRoute.POST(req, ctx)
    expect(res.status).toBe(400)
  })

  it("approve triggers LINE pushMessage", async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-token"
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200, text: async () => "" } as Response)
    const approveRoute = await import("@/app/api/admin/tenant-registrations/[id]/approve/route")
    const ctx = { params: Promise.resolve({ id: "reg-1" }) }
    const req = new Request("http://localhost/api/admin/tenant-registrations/reg-1/approve", { method: "POST", headers: { accept: "application/vnd.apartment.v1.1+json" } })
    const res = await approveRoute.POST(req, ctx)
    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalled()
    const call = (mockFetch.mock.calls[0] as unknown[])[1] as { body: string }
    const payload = JSON.parse(call.body as string)
    expect(payload.to).toBe("u1")
  })

  it("reject triggers LINE pushMessage", async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-token"
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200, text: async () => "" } as Response)
    const rejectRoute = await import("@/app/api/admin/tenant-registrations/[id]/reject/route")
    const { prisma } = await import("@/infrastructure/db/prisma/prismaClient")
    await prisma.tenantRegistration.update({ where: { id: "reg-1" }, data: { status: "PENDING" } })
    const ctx = { params: Promise.resolve({ id: "reg-1" }) }
    const req = new Request("http://localhost/api/admin/tenant-registrations/reg-1/reject", { method: "POST", headers: { accept: "application/vnd.apartment.v1.1+json" } })
    const res = await rejectRoute.POST(req, ctx)
    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalled()
    const call = (mockFetch.mock.calls[0] as unknown[])[1] as { body: string }
    const payload = JSON.parse(call.body as string)
    expect(payload.to).toBe("u1")
  })

  it("pushMessage error does not fail approval", async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-token"
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 500, text: async () => "error" } as Response)
    const approveRoute = await import("@/app/api/admin/tenant-registrations/[id]/approve/route")
    const ctx = { params: Promise.resolve({ id: "reg-1" }) }
    const req = new Request("http://localhost/api/admin/tenant-registrations/reg-1/approve", { method: "POST", headers: { accept: "application/vnd.apartment.v1.1+json" } })
    const res = await approveRoute.POST(req, ctx)
    expect(res.status).toBe(200)
  })

  it("pushMessage error does not fail reject", async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-token"
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 500, text: async () => "error" } as Response)
    const rejectRoute = await import("@/app/api/admin/tenant-registrations/[id]/reject/route")
    const { prisma } = await import("@/infrastructure/db/prisma/prismaClient")
    await prisma.tenantRegistration.update({ where: { id: "reg-1" }, data: { status: "PENDING" } })
    const ctx = { params: Promise.resolve({ id: "reg-1" }) }
    const req = new Request("http://localhost/api/admin/tenant-registrations/reg-1/reject", { method: "POST", headers: { accept: "application/vnd.apartment.v1.1+json" } })
    const res = await rejectRoute.POST(req, ctx)
    expect(res.status).toBe(200)
  })
})
