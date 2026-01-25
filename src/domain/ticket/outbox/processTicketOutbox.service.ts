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

function classifyOutboxError(error: unknown): "transient" | "permanent" {
  const e = error as Record<string, unknown> | null
  const status = typeof e?.["status"] === "number" ? (e?.["status"] as number) : undefined
  const code = typeof e?.["code"] === "string" ? (e?.["code"] as string) : undefined
  const name = typeof e?.["name"] === "string" ? (e?.["name"] as string) : undefined
  const message = typeof e?.["message"] === "string" ? (e?.["message"] as string).toLowerCase() : ""
  if (typeof status === "number") {
    if (status >= 500 || status === 429) return "transient"
    if (status >= 400 && status < 500) return "permanent"
  }
  if (code === "ETIMEDOUT" || code === "ECONNRESET") return "transient"
  if (code === "LINE_CONFIG_ERROR") return "permanent"
  if (message.includes("timeout") || message.includes("network") || message.includes("fetch")) return "transient"
  if (message.includes("token") || message.includes("config") || message.includes("invalid") || message.includes("payload")) return "permanent"
  if (name && name.toLowerCase().includes("typeerror")) return "transient"
  return "transient"
}

export async function processTicketOutbox(
  outboxId: string,
  deps: {
    sender: TicketOutboxSender
    outboxRepo: TicketOutboxGateway
  },
  runId?: string,
): Promise<{ status: "SENT" | "FAILED"; failureType?: "transient" | "permanent" }> {
  const rec = await deps.outboxRepo.findById(outboxId)
  if (!rec || rec.status !== "PENDING") return { status: "FAILED", failureType: "permanent" }
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
    return { status: "SENT" }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    const errorType = classifyOutboxError(err)
    if (errorType === "transient") {
      console.warn("[outbox] warn send failed", { runId, outboxId: rec.id, errorType, actionHint: "safe to retry", message: msg })
    } else {
      console.error("[outbox] error send failed", { runId, outboxId: rec.id, errorType, actionHint: "check payload or configuration", message: msg })
    }
    await deps.outboxRepo.markFailed(rec.id, msg)
    return { status: "FAILED", failureType: errorType }
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
  runId?: string,
): Promise<{ processed: number; success: number; failed: number; transientFailed: number; permanentFailed: number }> {
  const batch = await deps.outboxRepo.findEligibleBatch(limit)
  let processed = 0
  let success = 0
  let failed = 0
  let transientFailed = 0
  let permanentFailed = 0
  for (const { id } of batch) {
    try {
      const res = await processTicketOutbox(id, { sender: deps.sender, outboxRepo: deps.outboxRepo }, runId)
      processed++
      if (res.status === "SENT") {
        success++
      } else {
        failed++
        if (res.failureType === "transient") transientFailed++
        if (res.failureType === "permanent") permanentFailed++
      }
    } catch {
      failed++
      transientFailed++
    }
  }
  if (permanentFailed === processed && processed > 0) {
    console.error("[outbox] error batch", { runId, message: "All outbox items failed permanently", hint: "Stop runner and inspect system" })
  }
  return { processed, success, failed, transientFailed, permanentFailed }
}
