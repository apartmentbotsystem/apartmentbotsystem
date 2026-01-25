import { describe, it, expect, vi, beforeEach } from "vitest"
import { processTicketOutbox } from "@/domain/ticket/outbox/processTicketOutbox.service"
import type { TicketOutboxSender } from "@/domain/ticket/outbox/ticketOutboxSender"
import type { TicketOutboxGateway } from "@/domain/ticket/outbox/processTicketOutbox.service"

describe("processTicketOutbox", () => {
  let sender: TicketOutboxSender
  let repo: TicketOutboxGateway
  let store: {
    status: "PENDING" | "SENT" | "FAILED"
    errorMessage: string | null
  }

  beforeEach(() => {
    store = { status: "PENDING", errorMessage: null }
    sender = { send: vi.fn(async () => undefined) }
    repo = {
      findById: vi.fn(async () => ({
        id: "ob-1",
        ticketId: "t-1",
        status: store.status,
        payload: { messageText: "hello" },
      })),
      markSent: vi.fn(async (id: string, sentAt: Date) => {
        void id
        void sentAt
        store.status = "SENT"
        store.errorMessage = null
      }),
      markFailed: vi.fn(async (id: string, msg: string) => {
        void id
        store.status = "FAILED"
        store.errorMessage = msg
      }),
      getTicketExternalThreadId: vi.fn(async () => "line-thread-1"),
    }
  })

  it("success path: marks SENT", async () => {
    await processTicketOutbox("ob-1", { sender, outboxRepo: repo })
    expect(store.status).toBe("SENT")
    expect(store.errorMessage).toBeNull()
    expect((sender.send as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(1)
    const call = (sender.send as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0] as Record<string, unknown>
    expect(call["ticketId"]).toBe("t-1")
    expect(call["messageId"]).toBe("ob-1")
    expect(call["externalThreadId"]).toBe("line-thread-1")
    expect(call["text"]).toBe("hello")
  })

  it("sender throw: marks FAILED with errorMessage", async () => {
    ;(sender.send as unknown as { mockImplementation: (fn: (...args: unknown[]) => unknown) => void }).mockImplementation(async () => {
      throw new Error("network down")
    })
    await processTicketOutbox("ob-1", { sender, outboxRepo: repo })
    expect(store.status).toBe("FAILED")
    expect(store.errorMessage).toBe("network down")
  })
})
