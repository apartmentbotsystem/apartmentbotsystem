import { describe, it, expect } from "vitest"
import {
  recordInboundMessage,
  type InboundMessageInput,
  type TicketMessageGateway,
  type TicketMessageRecord,
  type AuditEmitter,
} from "@/modules/ticket/services/ticketInboundMessage.service"

class InMemoryMessageGateway implements TicketMessageGateway {
  public createdCalls: number = 0
  private store: TicketMessageRecord[] = []
  async create(input: { ticketId: string; direction: "INBOUND" | "OUTBOUND"; channel: "LINE"; messageText: string; createdAt: Date }): Promise<TicketMessageRecord> {
    this.createdCalls++
    const rec: TicketMessageRecord = {
      id: `m-${this.store.length + 1}`,
      ticketId: input.ticketId,
      direction: input.direction,
      channel: input.channel,
      messageText: input.messageText,
      createdAt: input.createdAt,
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

describe("Ticket conversation inbound", () => {
  it("inbound message creates TicketMessage and emits audit JSON-safe", async () => {
    const gateway = new InMemoryMessageGateway()
    const audit = new CollectAudit()
    const input: InboundMessageInput = { ticketId: "t-1", messageText: "มีน้ำรั่ว" }
    const id = await recordInboundMessage(input, gateway, audit)
    expect(id).toBe("m-1")
    expect(gateway.createdCalls).toBe(1)
    expect(audit.events.length).toBe(1)
    const ev = audit.events[0]
    expect(ev.action).toBe("TICKET_MESSAGE_RECEIVED")
    const after = ev.after as Record<string, unknown>
    expect(after["ticketId"]).toBe("t-1")
    expect(after["direction"]).toBe("INBOUND")
    expect(after["channel"]).toBe("LINE")
    expect(after["messageText"]).toBe("มีน้ำรั่ว")
    expect(typeof after["createdAt"]).toBe("string")
  })

  it("fails guard if audit payload uses Date", async () => {
    const gateway = new InMemoryMessageGateway()
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
    await recordInboundMessage({ ticketId: "t-1", messageText: "ทดสอบ Date" }, gateway, audit)
    expect(violated).toBe(false)
  })
})
