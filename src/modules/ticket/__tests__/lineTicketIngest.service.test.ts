import { describe, it, expect } from "vitest"
import {
  createTicketFromLine,
  type LineTicketIngestInput,
  type TicketGateway,
  type TicketRecord,
  type AuditEmitter,
} from "@/modules/ticket/services/lineTicketIngest.service"

class InMemoryTicketGateway implements TicketGateway {
  private store: TicketRecord[] = []
  async findByExternalThreadId(externalThreadId: string): Promise<TicketRecord | null> {
    return this.store.find((t) => t.externalThreadId === externalThreadId) ?? null
  }
  async createOpen(command: {
    source: "LINE"
    externalThreadId: string
    title: string
    tenantId?: string
    roomId?: string
    createdAt: Date
  }): Promise<TicketRecord> {
    const id = `t-${this.store.length + 1}`
    const rec: TicketRecord = {
      id,
      source: "LINE",
      externalThreadId: command.externalThreadId,
      title: command.title,
      status: "OPEN",
      tenantId: command.tenantId,
      roomId: command.roomId,
      createdAt: command.createdAt,
    }
    this.store.push(rec)
    return rec
  }
}

class CollectAudit implements AuditEmitter {
  events: Array<{ action: string; after?: Record<string, unknown> | null }> = []
  async emit(input: { action: string; after?: Record<string, unknown> | null }): Promise<void> {
    this.events.push({ action: input.action, after: input.after ?? null })
  }
}

describe("LINE Ticket Ingestion Service", () => {
  it("creates ticket from LINE input and emits JSON-safe audit", async () => {
    const gateway = new InMemoryTicketGateway()
    const audit = new CollectAudit()
    const input: LineTicketIngestInput = {
      source: "LINE",
      externalThreadId: "user-123",
      messageText: "น้ำรั่วเข้าห้องนอน",
      tenantId: "tenant-1",
      roomId: "room-101",
    }
    const ticketId = await createTicketFromLine(input, gateway, audit)
    expect(ticketId).toBe("t-1")
    expect(audit.events.length).toBe(1)
    const ev = audit.events[0]
    expect(ev.action).toBe("TICKET_CREATED")
    const after = ev.after as Record<string, unknown>
    expect(typeof after["ticketId"]).toBe("string")
    expect(after["source"]).toBe("LINE")
    expect(after["externalThreadId"]).toBe("user-123")
    expect(typeof after["title"]).toBe("string")
    expect(after["tenantId"]).toBe("tenant-1")
    expect(after["roomId"]).toBe("room-101")
    expect(typeof after["createdAt"]).toBe("string")
    expect(() => new Date(String(after["createdAt"])).toISOString()).not.toThrow()
  })

  it("fails if externalThreadId duplicate", async () => {
    const gateway = new InMemoryTicketGateway()
    const audit = new CollectAudit()
    const input: LineTicketIngestInput = {
      source: "LINE",
      externalThreadId: "dup-1",
      messageText: "ครั้งแรก",
    }
    await createTicketFromLine(input, gateway, audit)
    let thrown: unknown = null
    try {
      await createTicketFromLine({ ...input, messageText: "ครั้งที่สอง" }, gateway, audit)
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error).name).toBe("DomainError")
  })

  it("test fails if audit payload uses Date (guard)", async () => {
    const gateway = new InMemoryTicketGateway()
    let violated = false
    const audit: AuditEmitter = {
      async emit(input) {
        const after = input.after as Record<string, unknown>
        const createdAt = after["createdAt"]
        if (createdAt instanceof Date) {
          violated = true
        }
      },
    }
    const input: LineTicketIngestInput = {
      source: "LINE",
      externalThreadId: "user-iso-check",
      messageText: "เช็ค ISO",
    }
    await createTicketFromLine(input, gateway, audit)
    expect(violated).toBe(false)
  })
})
