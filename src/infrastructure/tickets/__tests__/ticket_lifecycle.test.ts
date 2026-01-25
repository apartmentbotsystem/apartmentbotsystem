import { describe, it, expect, beforeEach, vi } from "vitest"
import { assignTicket, startTicket, closeTicket } from "@/infrastructure/tickets/ticketLifecycle.service"
import { emitAuditEvent } from "@/infrastructure/audit/audit.service"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"

let state: { id: string; status: "OPEN" | "IN_PROGRESS" | "CLOSED"; closedAt: Date | null } = {
  id: "t1",
  status: "OPEN",
  closedAt: null,
}
vi.mock("@/infrastructure/db/prisma/prismaClient", () => {
  const ticket = {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      if (where.id !== state.id) return null
      return { id: state.id, status: state.status, closedAt: state.closedAt }
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      if (where.id !== state.id) throw new Error("not found")
      if (typeof data["status"] === "string") state.status = data["status"] as typeof state.status
      if (data["closedAt"] instanceof Date) state.closedAt = data["closedAt"] as Date
      return { id: state.id, status: state.status, closedAt: state.closedAt }
    }),
  }
  const auditEvent = {
    findFirst: vi.fn(async () => null),
  }
  const prisma = { ticket, auditEvent }
  return { prisma }
})

vi.mock("@/infrastructure/db/domainTransaction", () => ({
  domainTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
}))

vi.mock("@/infrastructure/audit/audit.service", () => {
  const emitAuditEvent = vi.fn(async () => undefined)
  return { emitAuditEvent }
})

describe("Ticket Lifecycle Service", () => {
  beforeEach(() => {
    state = { id: "t1", status: "OPEN", closedAt: null }
    ;(emitAuditEvent as unknown as { mockClear: () => void }).mockClear()
  })

  it("transitions OPEN → assign (no status change) → START → CLOSED", async () => {
    await assignTicket("t1", "admin-1")
    const afterAssign = await prisma.ticket.findUnique({ where: { id: "t1" } })
    expect(afterAssign?.status).toBe("OPEN")
    expect(emitAuditEvent).toHaveBeenCalled()
    {
      const calls = (emitAuditEvent as unknown as { mock: { calls: unknown[][] } }).mock.calls
      expect(calls.some((c) => (c[0] as { action?: string })?.action === "TICKET_ASSIGNED")).toBe(true)
    }
    await startTicket("t1", "admin-1")
    const afterStart = await prisma.ticket.findUnique({ where: { id: "t1" } })
    expect(afterStart?.status).toBe("IN_PROGRESS")
    expect(emitAuditEvent).toHaveBeenCalled()
    {
      const calls = (emitAuditEvent as unknown as { mock: { calls: unknown[][] } }).mock.calls
      expect(calls.some((c) => (c[0] as { action?: string })?.action === "TICKET_STARTED")).toBe(true)
    }
    await closeTicket("t1", "admin-1")
    const afterClose = await prisma.ticket.findUnique({ where: { id: "t1" } })
    expect(afterClose?.status).toBe("CLOSED")
    expect(afterClose?.closedAt).toBeInstanceOf(Date)
    expect(emitAuditEvent).toHaveBeenCalled()
    {
      const calls = (emitAuditEvent as unknown as { mock: { calls: unknown[][] } }).mock.calls
      expect(calls.some((c) => (c[0] as { action?: string })?.action === "TICKET_CLOSED")).toBe(true)
    }
  })

  it("throws error for OPEN → CLOSED transition", async () => {
    let thrown: unknown = null
    try {
      await closeTicket("t1", "admin-1")
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error).name).toBe("DomainError")
  })

  it("throws error for START when already IN_PROGRESS", async () => {
    let thrown: unknown = null
    state = { id: "t1", status: "IN_PROGRESS", closedAt: null }
    try {
      await startTicket("t1", "admin-1")
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error).name).toBe("DomainError")
  })
})
