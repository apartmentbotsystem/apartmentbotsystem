import type { TicketOutboxSender, TicketOutboxPayload } from "@/domain/ticket/outbox/ticketOutboxSender"
import { LineHttpClient } from "@/infrastructure/line/LineHttpClient"

export class LineTicketOutboxSender implements TicketOutboxSender {
  async send(payload: TicketOutboxPayload): Promise<void> {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
    if (!token || typeof token !== "string" || token.trim().length === 0) {
      throw Object.assign(new Error("LINE access token not configured"), { name: "DomainError", code: "LINE_CONFIG_ERROR" })
    }
    const client = new LineHttpClient(token)
    await client.pushMessage({
      to: payload.externalThreadId,
      messages: [{ type: "text", text: payload.text }],
    })
  }
}
