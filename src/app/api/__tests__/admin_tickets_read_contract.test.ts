import { describe, it, expect, vi, beforeEach } from "vitest"
import * as listRoute from "@/app/api/admin/tickets/route"
import * as detailRoute from "@/app/api/admin/tickets/[id]/route"
import * as auditRoute from "@/app/api/admin/tickets/[id]/audit/route"

vi.mock("@/infrastructure/tickets/ticketRead.service", () => {
  return {
    listTickets: vi.fn(async () => [
      {
        id: "t1",
        source: "LINE" as const,
        externalThreadId: "user-1",
        roomId: "room-1",
        tenantId: "tenant-1",
        title: "Hello",
        status: "OPEN" as const,
        createdAt: new Date(Date.UTC(2025, 0, 1)),
      },
      {
        id: "t2",
        source: "LINE" as const,
        externalThreadId: "user-2",
        roomId: null,
        tenantId: null,
        title: "Issue",
        status: "IN_PROGRESS" as const,
        createdAt: new Date(Date.UTC(2025, 0, 2)),
      },
    ]),
    getTicketDetail: vi.fn(async () => ({
      id: "t1",
      source: "LINE" as const,
      externalThreadId: "user-1",
      roomId: "room-1",
      tenantId: "tenant-1",
      title: "Hello",
      status: "IN_PROGRESS" as const,
      assignedAdminId: "admin-1",
      createdAt: new Date(Date.UTC(2025, 0, 1)),
      updatedAt: new Date(Date.UTC(2025, 0, 3)),
      closedAt: null,
    })),
    getTicketAuditTimeline: vi.fn(async () => [
      {
        id: "ae1",
        timestamp: new Date(Date.UTC(2025, 0, 1)),
        actorType: "SYSTEM" as const,
        actorId: null,
        action: "TICKET_CREATED",
        severity: "INFO" as const,
        metadata: { ticketId: "t1" },
      },
      {
        id: "ae2",
        timestamp: new Date(Date.UTC(2025, 0, 2)),
        actorType: "ADMIN" as const,
        actorId: "admin-1",
        action: "TICKET_ASSIGNED",
        severity: "INFO" as const,
        metadata: { adminId: "admin-1" },
      },
    ]),
  }
})

vi.mock("@/lib/guards", () => ({
  requireRole: async () => ({ userId: "admin-1", role: "ADMIN" }),
}))

describe("Admin Tickets Read API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("lists tickets with filters", async () => {
    const res = await listRoute.GET(new Request("http://localhost/api/admin/tickets?status=OPEN&source=LINE&page=1&limit=2"))
    expect(res.status).toBe(200)
    const json = (await res.json()) as Array<{
      id: string
      source: "LINE"
      externalThreadId: string
      roomId: string | null
      tenantId: string | null
      title: string
      status: "OPEN" | "IN_PROGRESS" | "CLOSED"
      createdAt: string
    }>
    expect(Array.isArray(json)).toBe(true)
    expect(json.length).toBe(2)
    expect(json[0].id).toBe("t1")
    expect(typeof json[0].createdAt).toBe("string")
  })

  it("gets ticket detail", async () => {
    const res = await detailRoute.GET(new Request("http://localhost/api/admin/tickets/t1"), { params: Promise.resolve({ id: "t1" }) })
    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      id: string
      assignedAdminId: string | null
      createdAt: string
      updatedAt: string
      closedAt: string | null
    }
    expect(json.id).toBe("t1")
    expect(json.assignedAdminId).toBe("admin-1")
    expect(typeof json.createdAt).toBe("string")
    expect(typeof json.updatedAt).toBe("string")
    expect(json.closedAt).toBeNull()
  })

  it("gets ticket audit timeline", async () => {
    const res = await auditRoute.GET(new Request("http://localhost/api/admin/tickets/t1/audit"), { params: Promise.resolve({ id: "t1" }) })
    expect(res.status).toBe(200)
    const json = (await res.json()) as Array<{
      id: string
      timestamp: string
      actorType: "ADMIN" | "STAFF" | "SYSTEM"
      action: string
    }>
    expect(Array.isArray(json)).toBe(true)
    expect(json.length).toBe(2)
    expect(json[0].action).toBe("TICKET_CREATED")
    expect(json[1].action).toBe("TICKET_ASSIGNED")
  })
})
