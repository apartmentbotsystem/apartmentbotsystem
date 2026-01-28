import { describe, it, expect, vi, beforeEach } from "vitest"

describe("Admin Tickets Lifecycle API", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("assign: admin passes -> 200", async () => {
    vi.doMock("@/lib/guards", () => ({ requireRole: async () => ({ userId: "admin-1", role: "ADMIN" }) }))
    vi.doMock("@/infrastructure/tickets/ticketLifecycle.service", () => ({ assignTicket: async () => undefined }))
    vi.doMock("@/infrastructure/tickets/ticketRead.service", () => ({
      getTicketDetail: async () => ({
        id: "t1",
        source: "LINE",
        externalThreadId: "user-1",
        roomId: null,
        tenantId: null,
        title: "Hello",
        status: "OPEN",
        assignedAdminId: "admin-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        closedAt: null,
      }),
    }))
    const route = await import("@/app/api/admin/tickets/[ticketId]/assign/route")
    const req = new Request("http://localhost/api/admin/tickets/t1/assign", { method: "POST" })
    const res = await route.POST(req, { params: Promise.resolve({ ticketId: "t1" }) })
    expect(res.status).toBe(200)
  })

  it("assign: non-admin -> 403", async () => {
    vi.doMock("@/lib/guards", () => ({
      requireRole: async () => {
        const { httpError } = await import("@/interface/errors/HttpError")
        const { ErrorCodes } = await import("@/interface/errors/error-codes")
        throw httpError(ErrorCodes.FORBIDDEN, "Forbidden")
      },
    }))
    const route = await import("@/app/api/admin/tickets/[ticketId]/assign/route")
    const req = new Request("http://localhost/api/admin/tickets/t1/assign", { method: "POST" })
    const res = await route.POST(req, { params: Promise.resolve({ ticketId: "t1" }) })
    expect(res.status).toBe(403)
  })

  it("start: invalid transition -> 409", async () => {
    vi.doMock("@/lib/guards", () => ({ requireRole: async () => ({ userId: "admin-1", role: "ADMIN" }) }))
    vi.doMock("@/infrastructure/tickets/ticketLifecycle.service", () => ({
      startTicket: async () => {
        const e = Object.assign(new Error("Invalid ticket status"), { name: "DomainError", code: "INVALID_TICKET_STATUS" })
        throw e
      },
    }))
    const route = await import("@/app/api/admin/tickets/[ticketId]/start/route")
    const req = new Request("http://localhost/api/admin/tickets/t1/start", { method: "POST" })
    const res = await route.POST(req, { params: Promise.resolve({ ticketId: "t1" }) })
    expect(res.status).toBe(409)
  })

  it("close: not found -> 404", async () => {
    vi.doMock("@/lib/guards", () => ({ requireRole: async () => ({ userId: "admin-1", role: "ADMIN" }) }))
    vi.doMock("@/infrastructure/tickets/ticketLifecycle.service", () => ({
      closeTicket: async () => {
        const e = Object.assign(new Error("Ticket not found"), { name: "DomainError", code: "TICKET_NOT_FOUND" })
        throw e
      },
    }))
    const route = await import("@/app/api/admin/tickets/[ticketId]/close/route")
    const req = new Request("http://localhost/api/admin/tickets/t1/close", { method: "POST" })
    const res = await route.POST(req, { params: Promise.resolve({ ticketId: "t1" }) })
    expect(res.status).toBe(404)
  })

  it("audit: missing ticketId -> 400", async () => {
    vi.doMock("@/lib/guards", () => ({ requireRole: async () => ({ userId: "admin-1", role: "ADMIN" }) }))
    const route = await import("@/app/api/admin/tickets/[ticketId]/audit/route")
    const req = new Request("http://localhost/api/admin/tickets//audit", { method: "GET" })
    const res = await route.GET(req, { params: Promise.resolve({ ticketId: "" }) })
    expect(res.status).toBe(400)
  })

  it("audit: admin passes -> 200", async () => {
    vi.doMock("@/lib/guards", () => ({ requireRole: async () => ({ userId: "admin-1", role: "ADMIN" }) }))
    vi.doMock("@/infrastructure/tickets/ticketRead.service", () => ({
      getTicketAuditTimeline: async () => [
        { id: "ae1", timestamp: new Date(), actorType: "SYSTEM", action: "TICKET_CREATED", severity: "INFO" },
      ],
    }))
    vi.doMock("@/interface/presenters/ticket.presenter", () => ({
      presentTicketAuditItem: (it: { action: string }) => ({ action: it.action }),
    }))
    const route = await import("@/app/api/admin/tickets/[ticketId]/audit/route")
    const req = new Request("http://localhost/api/admin/tickets/t1/audit", { method: "GET" })
    const res = await route.GET(req, { params: Promise.resolve({ ticketId: "t1" }) })
    expect(res.status).toBe(200)
  })
})
