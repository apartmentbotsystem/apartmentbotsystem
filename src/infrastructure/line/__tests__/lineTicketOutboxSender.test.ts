import { describe, it, expect, vi, beforeEach } from "vitest"
import { LineTicketOutboxSender } from "@/infrastructure/line/lineTicketOutboxSender"

describe("LineTicketOutboxSender", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-token"
  })

  it("sends successfully", async () => {
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    } as Response)
    const sender = new LineTicketOutboxSender()
    await expect(
      sender.send({ ticketId: "t1", messageId: "m1", text: "hello", externalThreadId: "u123" }),
    ).resolves.toBeUndefined()
    expect(mockFetch).toHaveBeenCalled()
    const calls = mockFetch.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const args = calls[0]
    expect(args[0]).toContain("https://api.line.me/v2/bot/message/push")
  })

  it("throws on API error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    } as Response)
    const sender = new LineTicketOutboxSender()
    await expect(
      sender.send({ ticketId: "t1", messageId: "m1", text: "hello", externalThreadId: "u123" }),
    ).rejects.toBeInstanceOf(Error)
  })

  it("throws on missing token", async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = ""
    const sender = new LineTicketOutboxSender()
    await expect(
      sender.send({ ticketId: "t1", messageId: "m1", text: "hello", externalThreadId: "u123" }),
    ).rejects.toBeInstanceOf(Error)
  })
})
