import { describe, it, expect, vi, beforeEach } from "vitest"

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

vi.mock("@/lib/guards", () => ({
  requireRole: async () => ({ userId: "admin-1", role: "ADMIN" }),
}))

describe("Admin Reported Payments API", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("success: returns list with resolved/pending flags", async () => {
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const auditEvent = {
        findMany: vi.fn(async () => [
          { id: "ae1", action: "PAYMENT_REPORTED", targetId: "inv-1", actorId: "tenant-1", timestamp: new Date("2026-01-01T01:00:00.000Z"), metadata: { lineUserId: "Uabcdef1234" } },
          { id: "ae2", action: "PAYMENT_REPORTED", targetId: "inv-2", actorId: "tenant-2", timestamp: new Date("2026-01-02T01:00:00.000Z"), metadata: { lineUserId: "Uxyz9876" } },
        ]),
        invoice: {
          findUnique: vi.fn(async ({ where: { id } }: { where: { id: string } }) =>
            id === "inv-1"
              ? {
                  id: "inv-1",
                  periodMonth: "2026-01",
                  totalAmount: 5000,
                  status: "PAID",
                  tenant: { id: "tenant-1", name: "Tenant A", lineUserId: "Uabcdef1234" },
                  room: { id: "room-1", roomNumber: "101" },
                }
              : {
                  id: "inv-2",
                  periodMonth: "2026-01",
                  totalAmount: 5200,
                  status: "SENT",
                  tenant: { id: "tenant-2", name: "Tenant B", lineUserId: "Uxyz9876" },
                  room: { id: "room-2", roomNumber: "102" },
                },
          ),
        },
      }
      return { prisma: auditEvent }
    })
    const route = await import("@/app/api/admin/payments/reported/route")
    const req = new Request("http://localhost/api/admin/payments/reported", { headers: { accept: AcceptEnvelope } })
    const res = await route.GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data?.items?.length).toBe(2)
    const [a, b] = json.data.items
    expect(a.invoiceId).toBe("inv-1")
    expect(a.resolved).toBe(true)
    expect(a.pending).toBe(false)
    expect(b.invoiceId).toBe("inv-2")
    expect(b.resolved).toBe(false)
    expect(b.pending).toBe(true)
  })

  it("empty list", async () => {
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      return { prisma: { auditEvent: { findMany: vi.fn(async () => []) } } }
    })
    const route = await import("@/app/api/admin/payments/reported/route")
    const req = new Request("http://localhost/api/admin/payments/reported", { headers: { accept: AcceptEnvelope } })
    const res = await route.GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data.items)).toBe(true)
    expect(json.data.items.length).toBe(0)
  })

  it("guard: admin-only", async () => {
    vi.doMock("@/lib/guards", () => ({
      requireRole: async () => {
        throw Object.assign(new Error("Forbidden"), { name: "HttpError", code: "FORBIDDEN", status: 403 })
      },
    }))
    const route = await import("@/app/api/admin/payments/reported/route")
    const req = new Request("http://localhost/api/admin/payments/reported", { headers: { accept: AcceptEnvelope } })
    const res = await route.GET(req)
    expect(res.status).toBe(403)
  })
})

