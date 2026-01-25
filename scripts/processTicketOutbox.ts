import { TicketOutboxGatewayPrisma } from "@/infrastructure/tickets/TicketOutboxGatewayPrisma"
import { LineTicketOutboxSender } from "@/infrastructure/line/lineTicketOutboxSender"
import { processTicketOutboxBatch } from "@/domain/ticket/outbox/processTicketOutbox.service"

async function main() {
  if (process.env.CLI_SKIP_DB === "1") {
    return
  }
  const gateway = new TicketOutboxGatewayPrisma()
  const sender = new LineTicketOutboxSender()
  const limit = 10
  console.log("[outbox] info start batch", { limit })
  const res = await processTicketOutboxBatch(limit, { sender, outboxRepo: gateway })
  console.log("[outbox] info summary", { processed: res.processed })
}

main().catch((e) => {
  console.error("[outbox] fatal", e)
  process.exitCode = 1
})
