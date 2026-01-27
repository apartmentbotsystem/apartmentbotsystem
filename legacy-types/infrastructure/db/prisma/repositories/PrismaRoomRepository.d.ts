declare module "@/infrastructure/db/prisma/repositories/PrismaRoomRepository" {
  import type { Room } from "@/domain/entities/Room"
  export class PrismaRoomRepository {
    findAll(filter?: { status?: string; numberContains?: string }): Promise<Room[]>
    findById(id: string): Promise<Room | null>
    findByNumber(number: string): Promise<Room | null>
    create(input: { number: string; status: string; maxOccupants: number }): Promise<Room>
    update(id: string, patch: { number?: string; status?: string; maxOccupants?: number }): Promise<Room>
    delete(id: string): Promise<void>
    getRoomsOccupancyTimeline(
      roomId?: string,
    ): Promise<
      Array<{
        roomId: string
        tenantId: string | null
        startDate: Date
        endDate: Date | null
        status: "occupied" | "vacant"
      }>
    >
    getAdminMonthlyOccupancyDashboard(
      month: string,
    ): Promise<
      Array<{
        roomId: string
        totalOccupiedDays: number
        occupancyRate: number
        firstOccupiedAt: Date | null
        lastVacatedAt: Date | null
      }>
    >
  }
}
