import { describe, it, expect, vi, beforeEach } from "vitest"

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

describe("Invoice Timeline API", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    vi.clearAllMocks()
    process.env.NODE_ENV = "development"
    vi.doMock("@/lib/guards", () => ({
      requireRole: async () => ({ userId: "admin-1", role: "ADMIN" }),
    }))
  })

  it("timeline orders by time and includes CREATED", async () => {
    const issued = new Date(Date.UTC(2026, 0, 5))
    const t1 = new Date(Date.UTC(2026, 0, 10))
    const t2 = new Date(Date.UTC(2026, 0, 15))
    vi.useFakeTimers()
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 20)))
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findUnique: vi.fn(async () => ({
            id: "inv-1",
            periodMonth: "2026-01",
            issuedAt: issued,
            paymentNote: "Paid cash",
          })),
        },
        auditEvent: {
          findMany: vi.fn(async () => [
            { id: "ae-1", timestamp: t1, actorType: "ADMIN", action: "INVOICE_SENT", targetType: "INVOICE", targetId: "inv-1", metadata: {} },
            { id: "ae-2", timestamp: t2, actorType: "ADMIN", action: "INVOICE_PAID", targetType: "INVOICE", targetId: "inv-1", metadata: {} },
          ]),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/invoices/[id]/timeline/route")
    const req = new Request("http://localhost/api/admin/invoices/inv-1/timeline", { method: "GET", headers: { accept: AcceptEnvelope } })
    const res = await route.GET(req, { params: Promise.resolve({ id: "inv-1" }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    const items = json.data.items as Array<{ action: string; timestamp: string; actor: string; metadata: Record<string, unknown> }>
    expect(items[0].action).toBe("CREATED")
    expect(items[1].action).toBe("INVOICE_SENT")
    expect(items[2].action).toBe("INVOICE_PAID")
    expect(items[2].metadata.paymentNote).toBe("Paid cash")
  })

  it("non-admin -> 403", async () => {
    vi.doMock("@/lib/guards", async () => {
      const { HttpError } = await import("@/interface/errors/HttpError")
      return {
        requireRole: async () => {
          throw new HttpError(403, "FORBIDDEN", "Forbidden")
        },
      }
    })
    const route = await import("@/app/api/admin/invoices/[id]/timeline/route")
    const req = new Request("http://localhost/api/admin/invoices/inv-1/timeline", { method: "GET", headers: { accept: AcceptEnvelope } })
    const res = await route.GET(req, { params: Promise.resolve({ id: "inv-1" }) })
    expect(res.status).toBe(403)
  })

  it("empty audit -> still show CREATED", async () => {
    const issued = new Date(Date.UTC(2026, 0, 5))
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findUnique: vi.fn(async () => ({
            id: "inv-empty",
            periodMonth: "2026-01",
            issuedAt: issued,
            paymentNote: null,
          })),
        },
        auditEvent: {
          findMany: vi.fn(async () => []),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/invoices/[id]/timeline/route")
    const req = new Request("http://localhost/api/admin/invoices/inv-empty/timeline", { method: "GET", headers: { accept: AcceptEnvelope } })
    const res = await route.GET(req, { params: Promise.resolve({ id: "inv-empty" }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    const items = json.data.items as Array<{ action: string }>
    expect(items.length).toBe(1)
    expect(items[0].action).toBe("CREATED")
  })
})
