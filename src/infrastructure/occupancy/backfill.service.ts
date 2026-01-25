import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { domainTransaction } from "@/infrastructure/db/domainTransaction"
import { createMoveIn } from "@/infrastructure/occupancy/occupancy.service"
import { emitAuditEvent } from "@/infrastructure/audit/audit.service"

export async function backfillOccupancyFromCurrentTenants(): Promise<{ created: number }> {
  return domainTransaction(async () => {
    const tenants = await prisma.tenant.findMany({ select: { id: true, roomId: true, role: true } })
    let created = 0
    const now = new Date()
    for (const t of tenants) {
      if (!t.roomId) continue
      const exists = await prisma.occupancyEvent.findFirst({
        where: { roomId: t.roomId, tenantId: t.id, type: "MOVE_IN" },
      })
      if (exists) continue
      await createMoveIn(t.roomId, t.id, now, "BACKFILL")
      created++
    }
    await emitAuditEvent({
      actorType: "SYSTEM",
      action: "OCCUPANCY_BACKFILL_EXECUTED",
      targetType: "AUTH",
      severity: "INFO",
      metadata: { created, at: now.toISOString() },
    })
    return { created }
  })
}
