import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { RoomDerivedStatus } from "@/domain/enums/room-derived-status"

export async function deriveRoomStatus(roomId: string, atDate?: Date): Promise<RoomDerivedStatus> {
  const upper = atDate ?? new Date()
  const events = await prisma.occupancyEvent.findMany({
    where: { roomId, eventAt: { lte: upper } },
    orderBy: { eventAt: "asc" },
    take: 5000,
  })
  const active = new Set<string>()
  for (const ev of events) {
    if (ev.type === "MOVE_IN" && ev.tenantId) active.add(ev.tenantId)
    else if (ev.type === "MOVE_OUT" && ev.tenantId) active.delete(ev.tenantId)
  }
  return active.size >= 1 ? RoomDerivedStatus.OCCUPIED : RoomDerivedStatus.AVAILABLE
}
