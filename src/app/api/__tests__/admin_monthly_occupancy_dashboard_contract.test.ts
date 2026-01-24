import { describe, it, expect, vi, beforeEach } from "vitest"
import * as route from "@/app/api/admin/dashboard/occupancy-monthly/route"

vi.mock("@/infrastructure/db/prisma/repositories/PrismaRoomRepository", () => {
  class MockRepo {
    async getAdminMonthlyOccupancyDashboard(
      month: string,
    ): Promise<
      Array<{
        roomId: string
        totalOccupiedDays: number
        occupancyRate: number
        firstOccupiedAt: Date | null
        lastVacatedAt: Date | null
      }>
    > {
      if (month === "2025-01") {
        return []
      }
      if (month === "2025-02") {
        return [
          {
            roomId: "room-1",
            totalOccupiedDays: 28,
            occupancyRate: 100,
            firstOccupiedAt: new Date(Date.UTC(2025, 1, 1)),
            lastVacatedAt: null,
          },
        ]
      }
      if (month === "2025-06") {
        return [
          {
            roomId: "room-2",
            totalOccupiedDays: 10,
            occupancyRate: 33.33,
            firstOccupiedAt: new Date(Date.UTC(2025, 5, 21)),
            lastVacatedAt: new Date(Date.UTC(2025, 5, 30)),
          },
        ]
      }
      return []
    }
  }
  return { PrismaRoomRepository: MockRepo }
})

describe("Admin Monthly Occupancy Dashboard GET", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 400 for invalid month format", async () => {
    const res = await route.GET(new Request("http://localhost/api/admin/dashboard/occupancy-monthly?month=2025-1"))
    expect(res.status).toBe(400)
  })

  it("returns empty array for month with no data", async () => {
    const res = await route.GET(new Request("http://localhost/api/admin/dashboard/occupancy-monthly?month=2025-01"))
    expect(res.status).toBe(200)
    const json = (await res.json()) as Array<{
      roomId: string
      totalOccupiedDays: number
      occupancyRate: number
      firstOccupiedAt: string | null
      lastVacatedAt: string | null
    }>
    expect(Array.isArray(json)).toBe(true)
    expect(json.length).toBe(0)
  })

  it("returns full month occupied item for February 2025", async () => {
    const res = await route.GET(new Request("http://localhost/api/admin/dashboard/occupancy-monthly?month=2025-02"))
    expect(res.status).toBe(200)
    const json = (await res.json()) as Array<{
      roomId: string
      totalOccupiedDays: number
      occupancyRate: number
      firstOccupiedAt: string | null
      lastVacatedAt: string | null
    }>
    expect(json.length).toBe(1)
    expect(json[0].roomId).toBe("room-1")
    expect(json[0].totalOccupiedDays).toBe(28)
    expect(json[0].occupancyRate).toBe(100)
    expect(json[0].firstOccupiedAt).toBe(new Date(Date.UTC(2025, 1, 1)).toISOString())
    expect(json[0].lastVacatedAt).toBeNull()
  })

  it("returns partial overlap item for June 2025", async () => {
    const res = await route.GET(new Request("http://localhost/api/admin/dashboard/occupancy-monthly?month=2025-06"))
    expect(res.status).toBe(200)
    const json = (await res.json()) as Array<{
      roomId: string
      totalOccupiedDays: number
      occupancyRate: number
      firstOccupiedAt: string | null
      lastVacatedAt: string | null
    }>
    expect(json.length).toBe(1)
    expect(json[0].roomId).toBe("room-2")
    expect(json[0].totalOccupiedDays).toBe(10)
    expect(json[0].occupancyRate).toBe(33.33)
    expect(json[0].firstOccupiedAt).toBe(new Date(Date.UTC(2025, 5, 21)).toISOString())
    expect(json[0].lastVacatedAt).toBe(new Date(Date.UTC(2025, 5, 30)).toISOString())
  })
})
