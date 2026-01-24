import type { OccupancyTimelineItemDTO } from "@/application/dto/rooms-occupancy-timeline.dto"

export function presentOccupancyTimelineItem(
  item: { roomId: string; tenantId: string | null; startDate: Date; endDate: Date | null; status: "occupied" | "vacant" },
): OccupancyTimelineItemDTO {
  return {
    roomId: item.roomId,
    tenantId: item.tenantId,
    startDate: item.startDate.toISOString(),
    endDate: item.endDate ? item.endDate.toISOString() : null,
    status: item.status,
  }
}
