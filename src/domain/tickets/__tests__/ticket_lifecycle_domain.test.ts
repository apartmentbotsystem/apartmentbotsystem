import { describe, it, expect } from "vitest"
import { openTicket, startTicket, closeTicket, type TicketLifecycleGateway, type AuditEmitter } from "@/domain/tickets/ticketLifecycle.service"

class InMemoryGateway implements TicketLifecycleGateway {
  private store = new Map<string, { id: string; status: "OPEN" | "IN_PROGRESS" | "CLOSED"; closedAt: Date | null }>()
  async getById(id: string) {
    return this.store.get(id) ?? null
  }
  async createOpen(data: { id?: string }) {
    const id = data.id ?? `t-${this.store.size + 1}`
    const row = { id, status: "OPEN" as const, closedAt: null }
    this.store.set(id, row)
    return row
  }
  async setStatus(id: string, status: "OPEN" | "IN_PROGRESS" | "CLOSED", closedAt?: Date | null) {
    const cur = this.store.get(id)
    if (!cur) throw new Error("not found")
    const next = { ...cur, status, closedAt: closedAt ?? null }
    this.store.set(id, next)
    return next
  }
}

class CollectAudit implements AuditEmitter {
  events: Array<{ action: string }> = []
  async emit(input: { action: string }) {
    this.events.push({ action: input.action })
  }
}

describe("Domain Ticket Lifecycle", () => {
  it("OPEN → IN_PROGRESS → CLOSED via domain service", async () => {
    const gw = new InMemoryGateway()
    const audit = new CollectAudit()
    const created = await openTicket(gw, audit, "admin-1", { id: "t1" })
    expect(created.status).toBe("OPEN")
    const started = await startTicket(gw, audit, "t1", "admin-1")
    expect(started.status).toBe("IN_PROGRESS")
    const closed = await closeTicket(gw, audit, "t1", "admin-1")
    expect(closed.status).toBe("CLOSED")
    expect(audit.events.map((e) => e.action)).toEqual(["TICKET_CREATED", "TICKET_STARTED", "TICKET_CLOSED"])
  })

  it("OPEN → CLOSED should throw", async () => {
    const gw = new InMemoryGateway()
    const audit = new CollectAudit()
    await openTicket(gw, audit, "admin-1", { id: "t2" })
    let thrown: unknown = null
    try {
      await closeTicket(gw, audit, "t2", "admin-1")
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error).name).toBe("DomainError")
  })
})
