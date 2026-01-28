import { describe, it, expect, vi, beforeEach } from "vitest"

function makeReq(url: string, init?: RequestInit, headers?: Record<string, string>) {
  const h = new Headers(init?.headers || {})
  if (headers) for (const [k, v] of Object.entries(headers)) h.set(k, v)
  return new Request(url, { ...init, headers: h })
}

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

type TicketRow = { id: string; status: "OPEN" | "IN_PROGRESS" | "CLOSED"; createdAt: Date; closedAt: Date | null }
type AuditRow = {
  id: string
  timestamp: Date
  actorType: "ADMIN" | "STAFF" | "SYSTEM"
  actorId: string | null
  action: string
  targetType: "TICKET"
  targetId: string
  severity: "INFO" | "WARN" | "CRITICAL"
  metadata: Record<string, unknown> | null
}

let ticket: TicketRow
let audits: AuditRow[]

vi.mock("@/lib/guards", () => ({
  requireRole: async () => ({ userId: "admin-1", role: "ADMIN" }),
}))

vi.mock("@/infrastructure/db/domainTransaction", () => ({
  domainTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
}))

vi.mock("@/infrastructure/db/prisma/prismaClient", () => {
  const prisma = {
    ticket: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (!ticket || where.id !== ticket.id) return null
        return { id: ticket.id, status: ticket.status, createdAt: ticket.createdAt, closedAt: ticket.closedAt }
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<TicketRow> }) => {
        if (!ticket || where.id !== ticket.id) throw new Error("not found")
        ticket = { ...ticket, status: (data.status ?? ticket.status) as TicketRow["status"], closedAt: (data.closedAt ?? ticket.closedAt) ?? null }
        return { id: ticket.id, status: ticket.status, closedAt: ticket.closedAt }
      },
    },
    auditEvent: {
      create: async ({ data }: { data: Partial<AuditRow> }) => {
        const row: AuditRow = {
          id: `ae-${audits.length + 1}`,
          timestamp: new Date(),
          actorType: (data.actorType ?? "SYSTEM") as AuditRow["actorType"],
          actorId: (data.actorId ?? null) as string | null,
          action: String(data.action ?? ""),
          targetType: "TICKET",
          targetId: String(data.targetId ?? ticket?.id ?? ""),
          severity: (data.severity ?? "INFO") as AuditRow["severity"],
          metadata: (data.metadata ?? null) as Record<string, unknown> | null,
        }
        audits.push(row)
        return row
      },
      findMany: async ({ where, orderBy }: { where: { targetType: string; targetId: string }; orderBy: { timestamp: "asc" | "desc" } }) => {
        const rows = audits.filter((a) => a.targetType === where.targetType && a.targetId === where.targetId)
        const asc: AuditRow[] = []
        for (const r of rows) {
          let i = 0
          while (i < asc.length && asc[i].timestamp.getTime() <= r.timestamp.getTime()) i++
          asc.splice(i, 0, r)
        }
        if (orderBy.timestamp === "asc") {
          return asc
        }
        const desc: AuditRow[] = []
        for (let i = asc.length - 1; i >= 0; i--) {
          desc.push(asc[i])
        }
        return desc
      },
      findFirst: async ({ where }: { where: { targetType: string; targetId: string; action: string } }) => {
        return audits.find((a) => a.targetType === where.targetType && a.targetId === where.targetId && a.action === where.action) ?? null
      },
    },
  }
  return { prisma }
})

describe("Admin Tickets Read Model Smoke", () => {
  beforeEach(() => {
    ticket = { id: "t-1", status: "OPEN", createdAt: new Date(Date.UTC(2025, 0, 1)), closedAt: null }
    audits = []
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("detail reflects status after start and after close; timeline includes events", async () => {
    const detailRoute = await import("@/app/api/admin/tickets/[ticketId]/route")
    const assignRoute = await import("@/app/api/admin/tickets/[ticketId]/assign/route")
    const startRoute = await import("@/app/api/admin/tickets/[ticketId]/start/route")
    const closeRoute = await import("@/app/api/admin/tickets/[ticketId]/close/route")
    const auditRoute = await import("@/app/api/admin/tickets/[ticketId]/audit/route")

    {
      const req = makeReq("http://localhost/api/admin/tickets/t-1", { method: "GET" }, { accept: AcceptEnvelope })
      const res = await detailRoute.GET(req, { params: Promise.resolve({ ticketId: "t-1" }) })
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.data.status).toBe("OPEN")
    }

    {
      const req = makeReq("http://localhost/api/admin/tickets/t-1/assign", { method: "POST" }, { accept: AcceptEnvelope })
      const res = await assignRoute.POST(req, { params: Promise.resolve({ ticketId: "t-1" }) })
      expect(res.status).toBe(200)
    }

    {
      const req = makeReq("http://localhost/api/admin/tickets/t-1/start", { method: "POST" }, { accept: AcceptEnvelope })
      const res = await startRoute.POST(req, { params: Promise.resolve({ ticketId: "t-1" }) })
      expect(res.status).toBe(200)
    }

    {
      const req = makeReq("http://localhost/api/admin/tickets/t-1", { method: "GET" }, { accept: AcceptEnvelope })
      const res = await detailRoute.GET(req, { params: Promise.resolve({ ticketId: "t-1" }) })
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.data.status).toBe("IN_PROGRESS")
    }

    {
      const req = makeReq("http://localhost/api/admin/tickets/t-1/close", { method: "POST" }, { accept: AcceptEnvelope })
      const res = await closeRoute.POST(req, { params: Promise.resolve({ ticketId: "t-1" }) })
      expect(res.status).toBe(200)
    }

    {
      const req = makeReq("http://localhost/api/admin/tickets/t-1", { method: "GET" }, { accept: AcceptEnvelope })
      const res = await detailRoute.GET(req, { params: Promise.resolve({ ticketId: "t-1" }) })
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.data.status).toBe("CLOSED")
      expect(json.data.closedAt).not.toBeNull()
    }

    {
      const req = makeReq("http://localhost/api/admin/tickets/t-1/audit", { method: "GET" }, { accept: AcceptEnvelope })
      const res = await auditRoute.GET(req, { params: Promise.resolve({ ticketId: "t-1" }) })
      expect(res.status).toBe(200)
      const json = await res.json()
      const actions = (json.data as Array<{ action: string }>).map((i) => i.action)
      expect(actions.includes("TICKET_STARTED")).toBe(true)
      expect(actions.includes("TICKET_CLOSED")).toBe(true)
    }
  })
})
