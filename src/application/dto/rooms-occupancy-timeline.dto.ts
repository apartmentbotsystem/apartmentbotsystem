export type OccupancyTimelineItemDTO = {
  roomId: string
  tenantId: string | null
  startDate: string
  endDate: string | null
  status: "occupied" | "vacant"
}
