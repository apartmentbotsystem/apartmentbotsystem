import type { AdminMonthlyOccupancyItemDTO } from "@/application/dto/admin-occupancy-monthly.dto"

export function presentAdminMonthlyItem(
  item: { roomId: string; totalOccupiedDays: number; occupancyRate: number; firstOccupiedAt: Date | null; lastVacatedAt: Date | null },
): AdminMonthlyOccupancyItemDTO {
  return {
    roomId: item.roomId,
    totalOccupiedDays: Number(item.totalOccupiedDays),
    occupancyRate: Number(item.occupancyRate),
    firstOccupiedAt: item.firstOccupiedAt ? item.firstOccupiedAt.toISOString() : null,
    lastVacatedAt: item.lastVacatedAt ? item.lastVacatedAt.toISOString() : null,
  }
}
