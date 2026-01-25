import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { domainTransaction } from "@/infrastructure/db/domainTransaction"
import { createMoveIn, createMoveOut } from "@/infrastructure/occupancy/occupancy.service"
import { emitAuditEvent } from "@/infrastructure/audit/audit.service"

export async function backfillOccupancyFromContracts(): Promise<{ created: number }> {
  return domainTransaction(async () => {
    const contracts = await prisma.contract.findMany({
      select: { id: true, roomId: true, tenantId: true, startDate: true, endDate: true },
    })
    let created = 0
    for (const c of contracts) {
      const inExists = await prisma.occupancyEvent.findFirst({
        where: { roomId: c.roomId, tenantId: c.tenantId, type: "MOVE_IN", eventAt: c.startDate },
      })
      if (!inExists) {
        await createMoveIn(c.roomId, c.tenantId, c.startDate, "BACKFILL")
        created++
      }
      if (c.endDate) {
        const outExists = await prisma.occupancyEvent.findFirst({
          where: { roomId: c.roomId, tenantId: c.tenantId, type: "MOVE_OUT", eventAt: c.endDate },
        })
        if (!outExists) {
          await createMoveOut(c.roomId, c.tenantId, c.endDate, "BACKFILL")
          created++
        }
      }
    }
    await emitAuditEvent({
      actorType: "SYSTEM",
      action: "OCCUPANCY_CONTRACT_BACKFILL_EXECUTED",
      targetType: "CONTRACT",
      severity: "INFO",
      metadata: { created },
    })
    return { created }
  })
}
