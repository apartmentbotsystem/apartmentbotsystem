import type { TicketOutboxSender, TicketOutboxPayload } from "@/domain/ticket/outbox/ticketOutboxSender"

type OutboxRecord = {
  id: string
  ticketId: string
  status: "PENDING" | "SENT" | "FAILED"
  payload: Record<string, unknown>
}

export interface TicketOutboxGateway {
  findById(id: string): Promise<OutboxRecord | null>
  markSent(id: string, sentAt: Date): Promise<void>
  markFailed(id: string, errorMessage: string): Promise<void>
  getTicketExternalThreadId(ticketId: string): Promise<string>
}

export async function processTicketOutbox(
  outboxId: string,
  deps: {
    sender: TicketOutboxSender
    outboxRepo: TicketOutboxGateway
  },
): Promise<void> {
  const rec = await deps.outboxRepo.findById(outboxId)
  if (!rec || rec.status !== "PENDING") return
  const ext = await deps.outboxRepo.getTicketExternalThreadId(rec.ticketId)
  const text = String((rec.payload as Record<string, unknown>)["messageText"] ?? "")
  const payload: TicketOutboxPayload = {
    ticketId: rec.ticketId,
    messageId: rec.id,
    text,
    externalThreadId: ext,
  }
  try {
    await deps.sender.send(payload)
    await deps.outboxRepo.markSent(rec.id, new Date())
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    console.warn("[outbox] warn send failed", rec.id, msg)
    await deps.outboxRepo.markFailed(rec.id, msg)
  }
}

type OutboxBatchGateway = TicketOutboxGateway & {
  findEligibleBatch(limit: number): Promise<Array<{ id: string }>>
}

export async function processTicketOutboxBatch(
  limit: number,
  deps: {
    sender: TicketOutboxSender
    outboxRepo: OutboxBatchGateway
  },
): Promise<{ processed: number }> {
  const batch = await deps.outboxRepo.findEligibleBatch(limit)
  let processed = 0
  for (const { id } of batch) {
    try {
      await processTicketOutbox(id, { sender: deps.sender, outboxRepo: deps.outboxRepo })
      processed++
    } catch {
      // continue processing other records
    }
  }
  return { processed }
}
