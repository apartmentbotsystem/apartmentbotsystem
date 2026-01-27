import { describe, it, expect, vi, beforeEach } from "vitest"

describe("Admin Invoice Reminder History API", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    vi.clearAllMocks()
    process.env.NODE_ENV = "development"
    vi.doMock("@/lib/guards", () => ({
      requireRole: async () => ({ userId: "admin-1", role: "ADMIN" }),
    }))
  })

  it("lists reminder history ordered by timestamp desc", async () => {
    const now = new Date(Date.UTC(2026, 1, 10, 9, 0, 0))
    vi.setSystemTime(now)
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        auditEvent: {
          findMany: vi.fn(async () => [
            {
              id: "ae-2",
              timestamp: new Date(now.getTime()),
              actorType: "ADMIN",
              actorId: "admin-1",
              action: "INVOICE_REMINDER_SENT",
              targetType: "INVOICE",
              targetId: "inv-1",
              severity: "INFO",
              metadata: { invoiceId: "inv-1", periodMonth: "2026-01", overdueDays: 10 },
            },
            {
              id: "ae-1",
              timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
              actorType: "ADMIN",
              actorId: "admin-2",
              action: "INVOICE_REMINDER_SENT",
              targetType: "INVOICE",
              targetId: "inv-1",
              severity: "INFO",
              metadata: { invoiceId: "inv-1", periodMonth: "2026-01", overdueDays: 8 },
            },
          ]),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/invoices/[id]/reminders/route")
    const req = new Request("http://localhost/api/admin/invoices/inv-1/reminders", { method: "GET", headers: { accept: "application/vnd.apartment.v1.1+json" } })
    const res = await route.GET(req, { params: Promise.resolve({ id: "inv-1" }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json.data.items)).toBe(true)
    expect(json.data.items.length).toBe(2)
    expect(json.data.items[0].id).toBe("ae-2")
    expect(typeof json.data.items[0].sentAt).toBe("string")
    expect(typeof json.data.items[0].overdueDays).toBe("number")
    expect(json.data.items[0].sentBy.id).toBe("admin-1")
  })

  it("forbidden for non-admin", async () => {
    vi.doMock("@/lib/guards", async () => {
      const { HttpError } = await import("@/interface/errors/HttpError")
      return {
        requireRole: async () => {
          throw new HttpError(403, "FORBIDDEN", "Forbidden")
        },
      }
    })
    const route = await import("@/app/api/admin/invoices/[id]/reminders/route")
    const req = new Request("http://localhost/api/admin/invoices/inv-1/reminders", { method: "GET" })
    const res = await route.GET(req, { params: Promise.resolve({ id: "inv-1" }) })
    expect(res.status).toBe(403)
  })
})
