import { describe, it, expect, vi, beforeEach } from "vitest"
import { ErrorCodes } from "@/interface/errors/error-codes"

vi.mock("@/infrastructure/db/prisma/prismaClient", () => {
  let tenants: Array<{ id: string; name: string; role: string; roomId: string | null; lineUserId: string | null }> = []
  const rooms: Record<string, { id: string; roomNumber: string; status: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE"; tenantId: string | null }> = {}
  const auditLogs: Array<{ id: string; action: string; adminId: string; tenantId: string | null; createdAt: Date }> = []
  function reset() {
    tenants = [
      { id: "t1", name: "Alice", role: "PRIMARY", roomId: "room-1", lineUserId: "u1" },
      { id: "t2", name: "Bob", role: "PRIMARY", roomId: null, lineUserId: "u2" },
    ]
    rooms["room-1"] = { id: "room-1", roomNumber: "101", status: "OCCUPIED", tenantId: "t1" }
  }
  reset()
  const prisma = {
    tenant: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => tenants.find((t) => t.id === where.id) ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { roomId: string | null } }) => {
        const t = tenants.find((x) => x.id === where.id)
        if (!t) throw new Error("tenant not found")
        t.roomId = data.roomId
        return { ...t }
      }),
    },
    room: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => rooms[where.id] ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { status?: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE"; tenantId?: string | null } }) => {
        const r = rooms[where.id]
        if (!r) throw new Error("room not found")
        if (data.status) r.status = data.status
        if (typeof data.tenantId !== "undefined") r.tenantId = data.tenantId
        return { ...r }
      }),
    },
    adminAuditLog: {
      create: vi.fn(async ({ data }: { data: { action: string; adminId: string; tenantId: string | null } }) => {
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

describe("Tenant Vacate API", () => {
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

  it("vacate success", async () => {
    const route = await import("@/app/api/admin/tenants/[id]/vacate/route")
    const ctx = { params: Promise.resolve({ id: "t1" }) }
    const req = new Request("http://localhost/api/admin/tenants/t1/vacate", { method: "POST", headers: { accept: "application/vnd.apartment.v1.1+json" } })
    const res = await route.POST(req, ctx)
    expect(res.status).toBe(200)
    const { prisma } = await import("@/infrastructure/db/prisma/prismaClient")
    const t = await prisma.tenant.findUnique({ where: { id: "t1" } })
    const r = await prisma.room.findUnique({ where: { id: "room-1" } })
    expect(t?.roomId).toBeNull()
    expect(r?.status).toBe("AVAILABLE")
    expect(r?.tenantId).toBeNull()
    const create = prisma.adminAuditLog.create as unknown as ReturnType<typeof vi.fn>
    const createdActions = create.mock.calls.map((call) => (call[0] as { data: { action: string } }).data.action)
    expect(createdActions).toContain("TENANT_VACATE")
  })

  it("vacate tenant without room -> 400", async () => {
    const route = await import("@/app/api/admin/tenants/[id]/vacate/route")
    const ctx = { params: Promise.resolve({ id: "t2" }) }
    const req = new Request("http://localhost/api/admin/tenants/t2/vacate", { method: "POST", headers: { accept: "application/vnd.apartment.v1.1+json" } })
    const res = await route.POST(req, ctx)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe(ErrorCodes.TENANT_NOT_IN_ROOM)
  })

  it("non-admin -> 403", async () => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doMock("@/lib/auth.config", () => ({
      auth: async () => ({ userId: "staff-1", role: "STAFF", capabilities: [] }),
    }))
    const route = await import("@/app/api/admin/tenants/[id]/vacate/route")
    const ctx = { params: Promise.resolve({ id: "t1" }) }
    const req = new Request("http://localhost/api/admin/tenants/t1/vacate", { method: "POST", headers: { accept: "application/vnd.apartment.v1.1+json" } })
    const res = await route.POST(req, ctx)
    expect(res.status).toBe(403)
  })
})
