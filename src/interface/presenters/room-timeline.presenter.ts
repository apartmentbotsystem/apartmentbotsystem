import type { RoomOccupancyTimelineItem } from "@/domain/interfaces/room-timeline-reader"

export function presentRoomTimelineItem(it: RoomOccupancyTimelineItem): {
  roomId: string
  tenantId: string | null
  startDate: string
  endDate: string | null
  status: "occupied" | "vacant"
} {
  return {
    roomId: it.roomId,
    tenantId: it.tenantId,
    startDate: it.startDate.toISOString(),
    endDate: it.endDate ? it.endDate.toISOString() : null,
    status: it.status,
  }
}
