export type RoomOccupancyTimelineItem = {
  roomId: string
  tenantId: string | null
  startDate: Date
  endDate: Date | null
  status: "occupied" | "vacant"
}

export interface RoomTimelineReader {
  getRoomTimeline(roomId: string, month: string): Promise<RoomOccupancyTimelineItem[]>
}
