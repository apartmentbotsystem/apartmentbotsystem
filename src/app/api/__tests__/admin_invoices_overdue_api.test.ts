import { describe, it, expect, vi, beforeEach } from "vitest"

describe("Admin Invoices List API (overdue fields)", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    vi.clearAllMocks()
    process.env.NODE_ENV = "development"
    process.env.INVOICE_GRACE_DAYS = "5"
    vi.doMock("@/lib/guards", () => ({
      requireRole: async () => ({ userId: "admin-1", role: "ADMIN" }),
    }))
  })

  it("response includes isOverdue and dueDate; overdue marked correctly", async () => {
    const now = new Date(Date.UTC(2026, 1, 10))
    vi.setSystemTime(now)
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          findMany: vi.fn(async () => [
            {
              id: "inv-sent-overdue",
              tenantId: "t1",
              roomId: "r1",
              periodMonth: "2026-01",
              rentAmount: 5000,
              totalAmount: 5000,
              status: "SENT",
              paidAt: null,
              tenant: { id: "t1", name: "Alice" },
              room: { id: "r1", roomNumber: "101" },
            },
            {
              id: "inv-sent-not-overdue",
              tenantId: "t2",
              roomId: "r2",
              periodMonth: "2026-02",
              rentAmount: 4500,
              totalAmount: 4500,
              status: "SENT",
              paidAt: null,
              tenant: { id: "t2", name: "Bob" },
              room: { id: "r2", roomNumber: "102" },
            },
            {
              id: "inv-paid",
              tenantId: "t3",
              roomId: "r3",
              periodMonth: "2026-01",
              rentAmount: 4000,
              totalAmount: 4000,
              status: "PAID",
              paidAt: new Date(Date.UTC(2026, 1, 5)),
              tenant: { id: "t3", name: "Carol" },
              room: { id: "r3", roomNumber: "103" },
            },
          ]),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/invoices/route")
    const req = new Request("http://localhost/api/admin/invoices?period=2026-01", { method: "GET", headers: { accept: "application/vnd.apartment.v1.1+json" } })
    const res = await route.GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json.data)).toBe(true)
    const row1 = json.data.find((r: { id: string }) => r.id === "inv-sent-overdue")
    expect(typeof row1.isOverdue).toBe("boolean")
    expect(typeof row1.dueDate).toBe("string")
    expect(row1.isOverdue).toBe(true)
    const rowPaid = json.data.find((r: { id: string }) => r.id === "inv-paid")
    expect(rowPaid.isOverdue).toBe(false)
  })
})
