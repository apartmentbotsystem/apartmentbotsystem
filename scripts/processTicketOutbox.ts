import { TicketOutboxGatewayPrisma } from "@/infrastructure/tickets/TicketOutboxGatewayPrisma"
import { LineTicketOutboxSender } from "@/infrastructure/line/lineTicketOutboxSender"
import { processTicketOutboxBatch } from "@/domain/ticket/outbox/processTicketOutbox.service"

async function main() {
  if (process.env.CLI_SKIP_DB === "1") {
    return
  }
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const gateway = new TicketOutboxGatewayPrisma()
  const sender = new LineTicketOutboxSender()
  const limit = 10
  console.log("[outbox] info start batch", { runId, limit })
  if (process.env.OUTBOX_DRY_RUN === "1") {
    const batch = await gateway.findEligibleBatch(limit)
    let processed = 0
    for (const { id } of batch) {
      const rec = await gateway.findById(id)
      if (!rec || rec.status !== "PENDING") continue
      const ext = await gateway.getTicketExternalThreadId(rec.ticketId)
      const text = String((rec.payload as Record<string, unknown>)["messageText"] ?? "")
      console.log("[outbox] info dry-run payload", { runId, messageId: rec.id, ticketId: rec.ticketId, externalThreadId: ext, text })
      processed++
    }
    console.log("[outbox] info summary", { runId, processed, success: 0, failed: 0, mode: "dry-run" })
    return
  }
  const res = await processTicketOutboxBatch(limit, { sender, outboxRepo: gateway }, runId)
  const nextAction =
    res.permanentFailed > 0 ? "inspect payload/config" : res.transientFailed > 0 ? "rerun later" : "none"
  console.log("[outbox] info summary", {
    runId,
    processed: res.processed,
    success: res.success,
    failed: res.failed,
    transientFailed: res.transientFailed,
    permanentFailed: res.permanentFailed,
    nextAction,
  })
}

main().catch((e) => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  console.error("[outbox] error fatal", { runId, error: String(e instanceof Error ? e.message : e) })
  process.exitCode = 1
})
