export type AdminMonthlyOccupancyItemDTO = {
  roomId: string
  totalOccupiedDays: number
  occupancyRate: number
  firstOccupiedAt: string | null
  lastVacatedAt: string | null
}
