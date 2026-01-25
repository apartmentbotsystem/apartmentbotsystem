import { describe, it, expect, vi, beforeEach } from "vitest"
import { processTicketOutbox } from "@/domain/ticket/outbox/processTicketOutbox.service"
import type { TicketOutboxSender } from "@/domain/ticket/outbox/ticketOutboxSender"
import type { TicketOutboxGateway } from "@/domain/ticket/outbox/processTicketOutbox.service"

describe("Retry Logic", () => {
  let sender: TicketOutboxSender
  let repo: TicketOutboxGateway & {
    retryCount: number
    nextRetryAt: Date | null
    status: "PENDING" | "SENT" | "FAILED"
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-25T12:00:00.000Z"))
    sender = { send: vi.fn(async () => undefined) }
    repo = {
      retryCount: 0,
      nextRetryAt: null,
      status: "PENDING",
      findById: vi.fn(async () => ({
        id: "ob-1",
        ticketId: "t-1",
        status: repo.status,
        payload: { messageText: "hello" },
      })),
      markSent: vi.fn(async () => {
        repo.status = "SENT"
      }),
      markFailed: vi.fn(async () => {
        repo.retryCount += 1
        const backoffMinutes = repo.retryCount === 1 ? 1 : repo.retryCount === 2 ? 5 : 30
        if (repo.retryCount >= 3) {
          repo.status = "FAILED"
          repo.nextRetryAt = null
        } else {
          repo.nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000)
        }
      }),
      getTicketExternalThreadId: vi.fn(async () => "line-thread-1"),
    }
  })

  it("increments retryCount and sets nextRetryAt", async () => {
    ;(sender.send as unknown as { mockImplementation: (fn: (...args: unknown[]) => unknown) => void }).mockImplementation(async () => {
      throw new Error("temporary")
    })
    await processTicketOutbox("ob-1", { sender, outboxRepo: repo })
    expect(repo.retryCount).toBe(1)
    expect(repo.nextRetryAt?.toISOString()).toBe("2026-01-25T12:01:00.000Z")
    // second failure
    vi.setSystemTime(new Date("2026-01-25T12:01:00.000Z"))
    await processTicketOutbox("ob-1", { sender, outboxRepo: repo })
    expect(repo.retryCount).toBe(2)
    expect(repo.nextRetryAt?.toISOString()).toBe("2026-01-25T12:06:00.000Z")
  })

  it("marks FAILED after max retries", async () => {
    ;(sender.send as unknown as { mockImplementation: (fn: (...args: unknown[]) => unknown) => void }).mockImplementation(async () => {
      throw new Error("temporary")
    })
    await processTicketOutbox("ob-1", { sender, outboxRepo: repo })
    await processTicketOutbox("ob-1", { sender, outboxRepo: repo })
    await processTicketOutbox("ob-1", { sender, outboxRepo: repo })
    expect(repo.retryCount).toBe(3)
    expect(repo.status).toBe("FAILED")
    expect(repo.nextRetryAt).toBeNull()
  })
})
