import { describe, it, expect } from "vitest"
import {
  replyToTicket,
  type TicketReplyInput,
  type TicketMessageGateway,
  type TicketOutboxGateway,
  type TicketMessageRecord,
  type TicketOutboxRecord,
  type AuditEmitter,
} from "@/modules/ticket/services/ticketReply.service"

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

class InMemoryOutboxGateway implements TicketOutboxGateway {
  public createdCalls: number = 0
  private store: TicketOutboxRecord[] = []
  async create(input: { ticketId: string; channel: "LINE"; payload: Record<string, unknown>; status: "PENDING"; createdAt: Date }): Promise<TicketOutboxRecord> {
    this.createdCalls++
    const rec: TicketOutboxRecord = {
      id: `o-${this.store.length + 1}`,
      ticketId: input.ticketId,
      channel: input.channel,
      payload: input.payload,
      status: input.status,
      createdAt: input.createdAt,
      sentAt: null,
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

describe("Ticket conversation reply", () => {
  it("outbound reply creates TicketMessage and Outbox(PENDING) and emits audit JSON-safe", async () => {
    const messages = new InMemoryMessageGateway()
    const outbox = new InMemoryOutboxGateway()
    const audit = new CollectAudit()
    const input: TicketReplyInput = { ticketId: "t-2", messageText: "กำลังดำเนินการครับ", actor: "ADMIN" }
    const res = await replyToTicket(input, messages, outbox, audit)
    expect(res.messageId).toBe("m-1")
    expect(res.outboxId).toBe("o-1")
    expect(messages.createdCalls).toBe(1)
    expect(outbox.createdCalls).toBe(1)
    expect(audit.events.length).toBe(1)
    const ev = audit.events[0]
    expect(ev.action).toBe("TICKET_MESSAGE_SENT")
    const after = ev.after as Record<string, unknown>
    expect(after["ticketId"]).toBe("t-2")
    expect(after["direction"]).toBe("OUTBOUND")
    expect(after["channel"]).toBe("LINE")
    expect(after["messageText"]).toBe("กำลังดำเนินการครับ")
    expect(after["outboxStatus"]).toBe("PENDING")
    expect(typeof after["createdAt"]).toBe("string")
  })

  it("fails guard if audit payload uses Date", async () => {
    const messages = new InMemoryMessageGateway()
    const outbox = new InMemoryOutboxGateway()
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
    const input: TicketReplyInput = { ticketId: "t-3", messageText: "เช็ค ISO", actor: "ADMIN" }
    await replyToTicket(input, messages, outbox, audit)
    expect(violated).toBe(false)
  })
})
