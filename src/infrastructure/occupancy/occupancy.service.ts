import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { domainTransaction } from "@/infrastructure/db/domainTransaction"
import { emitAuditEvent } from "@/infrastructure/audit/audit.service"
import { deriveRoomStatus } from "@/domain/occupancy/derive"

async function summarize(roomId: string, at: Date) {
  const events = await prisma.occupancyEvent.findMany({
    where: { roomId, eventAt: { lte: at } },
    orderBy: { eventAt: "asc" },
    take: 5000,
  })
  const active = new Set<string>()
  for (const ev of events) {
    if (ev.type === "MOVE_IN" && ev.tenantId) active.add(ev.tenantId)
    else if (ev.type === "MOVE_OUT" && ev.tenantId) active.delete(ev.tenantId)
  }
  return { activeTenants: Array.from(active.values()) }
}

export async function createMoveIn(roomId: string, tenantId: string, eventAt: Date, source: "SYSTEM" | "IMPORT" | "BACKFILL") {
  await domainTransaction(async () => {
    const before = await summarize(roomId, eventAt)
    await prisma.occupancyEvent.create({ data: { roomId, tenantId, type: "MOVE_IN", eventAt, source } })
    const after = await summarize(roomId, eventAt)
    await emitAuditEvent({
      actorType: "SYSTEM",
      action: "OCCUPANCY_MOVE_IN_CREATED",
      targetType: "TENANT",
      targetId: tenantId,
      severity: "INFO",
      before,
      after,
      metadata: { roomId, tenantId, eventAt: eventAt.toISOString(), source, derived: await deriveRoomStatus(roomId, eventAt) },
    })
  })
}

export async function createMoveOut(roomId: string, tenantId: string, eventAt: Date, source: "SYSTEM" | "IMPORT" | "BACKFILL") {
  await domainTransaction(async () => {
    const before = await summarize(roomId, eventAt)
    await prisma.occupancyEvent.create({ data: { roomId, tenantId, type: "MOVE_OUT", eventAt, source } })
    const after = await summarize(roomId, eventAt)
    await emitAuditEvent({
      actorType: "SYSTEM",
      action: "OCCUPANCY_MOVE_OUT_CREATED",
      targetType: "TENANT",
      targetId: tenantId,
      severity: "INFO",
      before,
      after,
      metadata: { roomId, tenantId, eventAt: eventAt.toISOString(), source, derived: await deriveRoomStatus(roomId, eventAt) },
    })
  })
}
