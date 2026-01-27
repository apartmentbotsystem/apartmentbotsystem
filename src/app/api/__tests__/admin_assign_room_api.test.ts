import { describe, it, expect, vi, beforeEach } from "vitest"
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
  const rooms: Record<string, { id: string; roomNumber: string; status: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE"; tenantId: string | null }> = {}
  let auditLogs: Array<{ id: string; action: string; adminId: string; tenantRegistrationId: string; tenantId: string | null; lineUserId: string | null; createdAt: Date }> = []
  function reset() {
    registrations = [
      { id: "reg-1", lineUserId: "u1", roomId: null, tenantId: "tenant-1", status: "PENDING", createdAt: new Date("2026-01-01T09:00:00Z"), approvedAt: null, approvedBy: null },
    ]
    tenants = [{ id: "tenant-1", name: "John", role: "PRIMARY", roomId: "room-1", lineUserId: null }]
    rooms["room-1"] = { id: "room-1", roomNumber: "101", status: "AVAILABLE", tenantId: null }
    rooms["room-2"] = { id: "room-2", roomNumber: "102", status: "OCCUPIED", tenantId: "tenant-2" }
    auditLogs = []
  }
  reset()
  const prisma = {
    tenantRegistration: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => registrations.find((r) => r.id === where.id) ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<(typeof registrations)[number]> }) => {
        const r = registrations.find((x) => x.id === where.id)
        if (!r) throw new Error("not found")
        Object.assign(r, data)
        return { ...r }
      }),
    },
    tenant: {
      findFirst: vi.fn(async ({ where }: { where: { roomId?: string; role?: string } }) => tenants.find((t) => (!where.roomId || t.roomId === where.roomId) && (!where.role || t.role === where.role)) ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { lineUserId?: string; roomId?: string } }) => {
        const t = tenants.find((x) => x.id === where.id)
        if (!t) throw new Error("tenant not found")
        if (typeof data.lineUserId === "string") t.lineUserId = data.lineUserId
        if (typeof data.roomId === "string") t.roomId = data.roomId
        return { ...t }
      }),
    },
    room: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => rooms[where.id] ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { status?: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE"; tenantId?: string } }) => {
        const r = rooms[where.id]
        if (!r) throw new Error("room not found")
        if (data.status) r.status = data.status
        if (typeof data.tenantId === "string") r.tenantId = data.tenantId
        return { ...r }
      }),
      findMany: vi.fn(async ({ where, orderBy }: { where?: { status?: string }; orderBy?: { roomNumber: "asc" | "desc" } }) => {
        void orderBy
        const all = Object.values(rooms)
        const filtered = where?.status ? all.filter((r) => r.status === where.status) : all
        return filtered.map((r) => ({ id: r.id, roomNumber: r.roomNumber, status: r.status }))
      }),
    },
    adminAuditLog: {
      create: vi.fn(async ({ data }: { data: { action: string; adminId: string; tenantRegistrationId: string; tenantId: string | null; lineUserId: string | null } }) => {
        auditLogs.push({ id: `a${auditLogs.length + 1}`, createdAt: new Date(), ...data })
        return { id: `a${auditLogs.length}`, ...data, createdAt: new Date() }
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => {
      return fn(prisma as unknown)
    }),
  }
  return { prisma, __reset: reset }
})

describe("Admin Approve + Assign Room", () => {
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

  it("lists available rooms for modal", async () => {
    const route = await import("@/app/api/admin/rooms/route")
    const req = new Request("http://localhost/api/admin/rooms?status=AVAILABLE", { method: "GET", headers: { accept: "application/vnd.apartment.v1.1+json" } })
    const res = await route.GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    const data = json.data as Array<{ id: string; roomNumber: string; status: string }>
    expect(data.some((r) => r.status === "AVAILABLE")).toBe(true)
  })

  it("approve and assign room success", async () => {
    const route = await import("@/app/api/admin/tenant-registrations/[id]/approve/route")
    const ctx = { params: Promise.resolve({ id: "reg-1" }) }
    const req = new Request("http://localhost/api/admin/tenant-registrations/reg-1/approve", {
      method: "POST",
      headers: { accept: "application/vnd.apartment.v1.1+json", "content-type": "application/json" },
      body: JSON.stringify({ roomId: "room-1" }),
    })
    const res = await route.POST(req, ctx)
    expect(res.status).toBe(200)
    const { prisma } = await import("@/infrastructure/db/prisma/prismaClient")
    const room = await prisma.room.findUnique({ where: { id: "room-1" } })
    const t = await prisma.tenant.findFirst({ where: { roomId: "room-1", role: "PRIMARY" } })
    expect(room?.status).toBe("OCCUPIED")
    expect(room?.tenantId).toBe("tenant-1")
    expect(t?.lineUserId).toBe("u1")
  })

  it("reject when room not available -> 409", async () => {
    const { prisma } = await import("@/infrastructure/db/prisma/prismaClient")
    await prisma.room.update({ where: { id: "room-2" }, data: { status: "OCCUPIED" } })
    const route = await import("@/app/api/admin/tenant-registrations/[id]/approve/route")
    const ctx = { params: Promise.resolve({ id: "reg-1" }) }
    const req = new Request("http://localhost/api/admin/tenant-registrations/reg-1/approve", {
      method: "POST",
      headers: { accept: "application/vnd.apartment.v1.1+json", "content-type": "application/json" },
      body: JSON.stringify({ roomId: "room-2" }),
    })
    const res = await route.POST(req, ctx)
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error.code).toBe(ErrorCodes.ROOM_NOT_AVAILABLE)
  })

  it("creates TENANT_ASSIGN_ROOM audit log", async () => {
    const route = await import("@/app/api/admin/tenant-registrations/[id]/approve/route")
    const ctx = { params: Promise.resolve({ id: "reg-1" }) }
    const req = new Request("http://localhost/api/admin/tenant-registrations/reg-1/approve", {
      method: "POST",
      headers: { accept: "application/vnd.apartment.v1.1+json", "content-type": "application/json" },
      body: JSON.stringify({ roomId: "room-1" }),
    })
    const res = await route.POST(req, ctx)
    expect(res.status).toBe(200)
    const { prisma } = await import("@/infrastructure/db/prisma/prismaClient")
    const create = prisma.adminAuditLog.create as unknown as ReturnType<typeof vi.fn>
    const createdActions = create.mock.calls.map((call) => (call[0] as { data: { action: string } }).data.action)
    expect(createdActions).toContain("TENANT_ASSIGN_ROOM")
  })
})
