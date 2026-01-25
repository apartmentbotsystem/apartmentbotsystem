export type TicketOutboxPayload = {
  ticketId: string
  messageId: string
  text: string
  externalThreadId: string
}

export interface TicketOutboxSender {
  send(payload: TicketOutboxPayload): Promise<void>
}
