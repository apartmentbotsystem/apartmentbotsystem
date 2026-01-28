import { describe, it, expect, vi, beforeEach } from "vitest"
import { TicketsNoReplyCandidatesDTO } from "@/interface/validators/report.schema"

function makeReq(url: string, init?: RequestInit, headers?: Record<string, string>) {
  const h = new Headers(init?.headers || {})
  if (headers) for (const [k, v] of Object.entries(headers)) h.set(k, v)
  return new Request(url, { ...init, headers: h })
}

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

describe("Automation Candidates: Tickets No-Reply API", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it("is read-only: does not write to DB", async () => {
    const today = new Date(Date.UTC(2026, 3, 10))
    vi.setSystemTime(today)
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const ticket = {
        findMany: vi.fn(async () => [
          { id: "t1", createdAt: new Date(Date.UTC(2026, 3, 1)) },
          { id: "t2", createdAt: new Date(Date.UTC(2026, 3, 5)) },
        ]),
        create: vi.fn(async () => ({})),
        update: vi.fn(async () => ({})),
        delete: vi.fn(async () => ({})),
      }
      const auditEvent = {
        findMany: vi.fn(async () => [
          { targetId: "t1", action: "TICKET_MESSAGE_SENT", timestamp: new Date(Date.UTC(2026, 3, 4)) },
          { targetId: "t2", action: "TICKET_MESSAGE_RECEIVED", timestamp: new Date(Date.UTC(2026, 3, 6)) },
        ]),
      }
      return { prisma: { ticket, auditEvent } }
    })
    const route = await import("@/app/api/admin/automation-candidates/tickets/no-reply/route")
    const req = makeReq("http://localhost/api/admin/automation-candidates/tickets/no-reply?thresholdDays=3", { method: "GET" }, { accept: AcceptEnvelope })
    const res = await route.GET(req)
    const json = await res.json()
    TicketsNoReplyCandidatesDTO.parse(json.data)
    const prismaMod = await import("@/infrastructure/db/prisma/prismaClient")
    expect((prismaMod.prisma.ticket.create as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0)
    expect((prismaMod.prisma.ticket.update as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0)
    expect((prismaMod.prisma.ticket.delete as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0)
  })

  it("is deterministic for same input", async () => {
    const today = new Date(Date.UTC(2026, 3, 10))
    vi.setSystemTime(today)
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const ticket = {
        findMany: vi.fn(async () => [{ id: "t1", createdAt: new Date(Date.UTC(2026, 3, 1)) }]),
      }
      const auditEvent = {
        findMany: vi.fn(async () => [{ targetId: "t1", action: "TICKET_MESSAGE_SENT", timestamp: new Date(Date.UTC(2026, 3, 2)) }]),
      }
      return { prisma: { ticket, auditEvent } }
    })
    const route = await import("@/app/api/admin/automation-candidates/tickets/no-reply/route")
    const req = makeReq("http://localhost/api/admin/automation-candidates/tickets/no-reply?thresholdDays=3", { method: "GET" }, { accept: AcceptEnvelope })
    const res1 = await route.GET(req)
    const res2 = await route.GET(req)
    const j1 = await res1.json()
    const j2 = await res2.json()
    TicketsNoReplyCandidatesDTO.parse(j1.data)
    TicketsNoReplyCandidatesDTO.parse(j2.data)
    expect(JSON.stringify(j1.data)).toBe(JSON.stringify(j2.data))
  })
})
