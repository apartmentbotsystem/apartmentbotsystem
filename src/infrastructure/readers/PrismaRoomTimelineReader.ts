import type { RoomTimelineReader, RoomOccupancyTimelineItem } from "@/domain/interfaces/room-timeline-reader"
import { PrismaRoomRepository } from "@/infrastructure/db/prisma/repositories/PrismaRoomRepository"

export class PrismaRoomTimelineReader implements RoomTimelineReader {
  private readonly repo = new PrismaRoomRepository()

  async getRoomTimeline(roomId: string, month: string): Promise<RoomOccupancyTimelineItem[]> {
    const parts = String(month).split("-")
    if (parts.length !== 2) return []
    const year = Number(parts[0])
    const monthIndex = Number(parts[1]) // 1-based
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 1 || monthIndex > 12) return []
    const monthStart = new Date(Date.UTC(year, monthIndex - 1, 1))
    const monthEnd = new Date(Date.UTC(year, monthIndex, 0, 23, 59, 59, 999))
    const items = await this.repo.getRoomsOccupancyTimeline(roomId)
    return items.filter((it) => {
      const start = it.startDate ?? new Date(0)
      const end = it.endDate ?? new Date(8640000000000000) // max
      return !(end < monthStart || start > monthEnd)
    })
  }
}
