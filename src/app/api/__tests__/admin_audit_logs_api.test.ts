import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/infrastructure/db/prisma/prismaClient", () => {
  let logs: Array<{
    id: string
    action: "TENANT_REGISTRATION_APPROVE" | "TENANT_REGISTRATION_REJECT"
    adminId: string
    tenantRegistrationId: string
    tenantId: string | null
    lineUserId: string | null
    createdAt: Date
  }> = []
  function reset() {
    logs = [
      {
        id: "a1",
        action: "TENANT_REGISTRATION_APPROVE",
        adminId: "admin-1",
        tenantRegistrationId: "reg-1",
        tenantId: "tenant-1",
        lineUserId: "u1",
        createdAt: new Date("2025-01-02T10:00:00.000Z"),
      },
      {
        id: "a2",
        action: "TENANT_REGISTRATION_REJECT",
        adminId: "admin-2",
        tenantRegistrationId: "reg-2",
        tenantId: null,
        lineUserId: "u2",
        createdAt: new Date("2025-01-03T10:00:00.000Z"),
      },
    ]
  }
  reset()
  const prisma = {
    adminAuditLog: {
      findMany: vi.fn(async (args?: unknown) => {
        void args
        return [...logs]
      }),
    },
  }
  return { prisma, __reset: reset }
})

describe("Admin Audit Logs API", () => {
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

  it("list audit logs (admin)", async () => {
    const route = await import("@/app/api/admin/audit-logs/route")
    const req = new Request("http://localhost/api/admin/audit-logs?limit=50", { method: "GET", headers: { accept: "application/vnd.apartment.v1.1+json" } })
    const res = await route.GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data.length).toBeGreaterThan(0)
    expect(json.data[0].id).toBeDefined()
    expect(json.data[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it("forbidden for non-admin", async () => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doMock("@/lib/auth.config", () => ({
      auth: async () => ({ userId: "staff-1", role: "STAFF", capabilities: [] }),
    }))
    const route = await import("@/app/api/admin/audit-logs/route")
    const req = new Request("http://localhost/api/admin/audit-logs", { method: "GET", headers: { accept: "application/vnd.apartment.v1.1+json" } })
    const res = await route.GET(req)
    expect(res.status).toBe(403)
  })
})
