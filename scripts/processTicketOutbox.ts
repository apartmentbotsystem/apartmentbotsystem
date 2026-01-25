import { TicketOutboxGatewayPrisma } from "@/infrastructure/tickets/TicketOutboxGatewayPrisma"
import { LineTicketOutboxSender } from "@/infrastructure/line/lineTicketOutboxSender"
import { processTicketOutboxBatch } from "@/domain/ticket/outbox/processTicketOutbox.service"

async function main() {
  if (process.env.CLI_SKIP_DB === "1") {
    return
  }
  const gateway = new TicketOutboxGatewayPrisma()
  const sender = new LineTicketOutboxSender()
  await processTicketOutboxBatch(10, { sender, outboxRepo: gateway })
}

main().catch((e) => {
  console.error("[outbox] fatal", e)
  process.exitCode = 1
})
