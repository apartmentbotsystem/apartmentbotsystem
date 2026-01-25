import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST as ReplyPOST } from "@/app/api/admin/tickets/[ticketId]/reply/route"

function makeReq(url: string, init?: RequestInit, headers?: Record<string, string>) {
  const h = new Headers(init?.headers || {})
  if (headers) for (const [k, v] of Object.entries(headers)) h.set(k, v)
  return new Request(url, { ...init, headers: h })
}

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

let msgCreateCalls: Array<Record<string, unknown>> = []
let outboxCreateCalls: Array<Record<string, unknown>> = []

vi.mock("@/lib/guards", () => ({
  requireRole: async () => ({ userId: "admin-1", role: "ADMIN" }),
}))

vi.mock("@/infrastructure/tickets/TicketMessageGatewayPrisma", () => {
  class Stub {
    async create(input: Record<string, unknown>) {
      msgCreateCalls.push(input)
      return {
        id: "msg-123",
        ticketId: input["ticketId"],
        direction: "OUTBOUND",
        channel: "LINE",
        messageText: input["messageText"],
        createdAt: new Date(input["createdAt"] as string | number | Date),
      }
    }
  }
  return { TicketMessageGatewayPrisma: Stub }
})

vi.mock("@/infrastructure/tickets/TicketOutboxGatewayPrisma", () => {
  class Stub {
    async create(input: Record<string, unknown>) {
      outboxCreateCalls.push(input)
      return {
        id: "ob-123",
        ticketId: input["ticketId"],
        channel: "LINE",
        payload: input["payload"] as Record<string, unknown>,
        status: "PENDING",
        createdAt: new Date(input["createdAt"] as string | number | Date),
        sentAt: null,
      }
    }
  }
  return { TicketOutboxGatewayPrisma: Stub }
})

vi.mock("@/infrastructure/audit/audit.service", () => {
  const emitAuditEvent = vi.fn(async () => undefined)
  return { emitAuditEvent }
})

beforeEach(() => {
  msgCreateCalls = []
  outboxCreateCalls = []
  vi.restoreAllMocks()
})

describe("Admin Tickets Reply API", () => {
  it("creates OUTBOUND message and PENDING outbox with JSON-safe audit", async () => {
    const body = { messageText: "สวัสดีครับ" }
    const ctx = { params: Promise.resolve({ ticketId: "t-1" }) }
    const req = makeReq(
      "http://localhost/api/admin/tickets/t-1/reply",
      { method: "POST", body: JSON.stringify(body) },
      { "content-type": "application/json", accept: AcceptEnvelope },
    )
    const res = await ReplyPOST(req, ctx)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toMatchObject({ messageId: "msg-123", outboxId: "ob-123" })
    expect(msgCreateCalls.length).toBe(1)
    expect(outboxCreateCalls.length).toBe(1)
    const msg = msgCreateCalls[0]
    const ob = outboxCreateCalls[0]
    expect(msg["direction"]).toBe("OUTBOUND")
    expect(ob["status"]).toBe("PENDING")
    const { emitAuditEvent } = await import("@/infrastructure/audit/audit.service")
    const calls = (emitAuditEvent as unknown as { mock: { calls: unknown[][] } }).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const last = calls[calls.length - 1][0] as { after?: Record<string, unknown> }
    expect(typeof last.after?.["createdAt"]).toBe("string")
  })

  it("400 on invalid input", async () => {
    const ctx = { params: Promise.resolve({ ticketId: "t-1" }) }
    const req = makeReq(
      "http://localhost/api/admin/tickets/t-1/reply",
      { method: "POST", body: JSON.stringify({}) },
      { "content-type": "application/json", accept: AcceptEnvelope },
    )
    const res = await ReplyPOST(req, ctx)
    expect(res.status).toBe(400)
  })
})
