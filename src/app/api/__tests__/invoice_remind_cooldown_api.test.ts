import { describe, it, expect, vi, beforeEach } from "vitest"

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

describe("Admin Invoice Remind API - Cooldown", () => {
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

  it("first send -> success; second within 24h -> 400; after 24h -> success", async () => {
    const now = new Date(Date.UTC(2026, 1, 10, 9, 0, 0))
    vi.setSystemTime(now)
    const auditEvents: Array<{ id: string; timestamp: Date; action: string; metadata: Record<string, unknown> }> = []
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findUnique: vi.fn(async () => ({
            id: "inv-1",
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
          findFirst: vi.fn(async ({ where }: { where: { action: string; metadata: unknown } }) => {
            const targetId = (where.metadata as { path: string[]; equals: string }).equals
            let latest: { id: string; timestamp: Date; action: string; metadata: Record<string, unknown> } | null = null
            for (const e of auditEvents) {
              if (e.action !== where.action) continue
              if (String(e.metadata["invoiceId"]) !== String(targetId)) continue
              if (!latest || e.timestamp.getTime() > latest.timestamp.getTime()) latest = e
            }
            return latest
          }),
          create: vi.fn(async ({ data }: { data: { action: string; timestamp?: Date; metadata: Record<string, unknown> } }) => {
            const ev = { id: `ae-${auditEvents.length + 1}`, timestamp: now, action: data.action, metadata: data.metadata }
            auditEvents.push(ev)
            return { id: ev.id }
          }),
          findMany: vi.fn(async () => []),
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
    const req1 = new Request("http://localhost/api/admin/invoices/inv-1/remind", { method: "POST", headers: { accept: AcceptEnvelope } })
    const res1 = await route.POST(req1, { params: Promise.resolve({ id: "inv-1" }) })
    expect(res1.status).toBe(200)
    expect(mockFetch).toHaveBeenCalled()
    const req2 = new Request("http://localhost/api/admin/invoices/inv-1/remind", { method: "POST", headers: { accept: AcceptEnvelope } })
    const res2 = await route.POST(req2, { params: Promise.resolve({ id: "inv-1" }) })
    expect(res2.status).toBe(400)
    const json2 = await res2.json()
    expect(json2.code).toBe("REMINDER_COOLDOWN_ACTIVE")
    expect(typeof json2.retryAfterHours).toBe("number")
    vi.setSystemTime(new Date(now.getTime() + 25 * 60 * 60 * 1000))
    const req3 = new Request("http://localhost/api/admin/invoices/inv-1/remind", { method: "POST", headers: { accept: AcceptEnvelope } })
    const res3 = await route.POST(req3, { params: Promise.resolve({ id: "inv-1" }) })
    expect(res3.status).toBe(200)
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
    const req = new Request("http://localhost/api/admin/invoices/inv-1/remind", { method: "POST", headers: { accept: AcceptEnvelope } })
    const res = await route.POST(req, { params: Promise.resolve({ id: "inv-1" }) })
    expect(res.status).toBe(403)
  })
})
