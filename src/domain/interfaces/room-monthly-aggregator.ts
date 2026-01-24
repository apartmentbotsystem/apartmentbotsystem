export type MonthlyOccupancyItem = {
  roomId: string
  totalOccupiedDays: number
  occupancyRate: number
  firstOccupiedAt: Date | null
  lastVacatedAt: Date | null
}

export interface RoomMonthlyAggregator {
  getMonthlyOccupancy(month: string): Promise<MonthlyOccupancyItem[]>
}
