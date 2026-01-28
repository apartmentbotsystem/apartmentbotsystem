import { describe, it, expect, vi, beforeEach } from "vitest"

describe("Occupancy Metrics Overview API", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    vi.clearAllMocks()
    process.env.NODE_ENV = "development"
    vi.doMock("@/lib/guards", () => ({
      requireRole: async () => ({ userId: "admin-1", role: "ADMIN" }),
    }))
  })

  it("returns 400 for invalid month format (envelope)", async () => {
    const route = await import("@/app/api/metrics/occupancy/overview/route")
    const res = await route.GET(new Request("http://localhost/api/metrics/occupancy/overview?month=2025-1", { headers: { accept: "application/vnd.apartment.v1.1+json" } }))
    expect(res.status).toBe(400)
  })

  it("handles empty month with zero KPIs and empty trends", async () => {
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        room: {
          findMany: vi.fn(async () => []),
        },
        occupancyEvent: {
          findMany: vi.fn(async () => []),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/metrics/occupancy/overview/route")
    const res = await route.GET(new Request("http://localhost/api/metrics/occupancy/overview?month=2025-01", { headers: { accept: "application/vnd.apartment.v1.1+json" } }))
    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      success: boolean
      data: {
        periodMonth: string
        kpis: { totalRooms: number; occupiedRooms: number; vacantRooms: number; occupancyRate: number }
        monthly: { moveInCount: number; moveOutCount: number }
        trends: { moveInDaily: Array<{ date: string; count: number }>; moveOutDaily: Array<{ date: string; count: number }> }
      }
    }
    expect(json.success).toBe(true)
    expect(json.data.periodMonth).toBe("2025-01")
    expect(json.data.kpis.totalRooms).toBe(0)
    expect(json.data.kpis.occupiedRooms).toBe(0)
    expect(json.data.kpis.vacantRooms).toBe(0)
    expect(json.data.kpis.occupancyRate).toBe(0)
    expect(json.data.monthly.moveInCount).toBe(0)
    expect(json.data.monthly.moveOutCount).toBe(0)
    expect(Array.isArray(json.data.trends.moveInDaily)).toBe(true)
    expect(Array.isArray(json.data.trends.moveOutDaily)).toBe(true)
  })

  it("computes KPIs and trends for sample month", async () => {
    const month = "2026-02"
    const moveIn1 = new Date(Date.UTC(2026, 1, 5))
    const moveOut1 = new Date(Date.UTC(2026, 1, 10))
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        room: {
          findMany: vi.fn(async () => [
            { id: "r1", status: "OCCUPIED" },
            { id: "r2", status: "OCCUPIED" },
            { id: "r3", status: "AVAILABLE" },
          ]),
        },
        occupancyEvent: {
          findMany: vi.fn(async () => [
            { id: "e1", roomId: "r1", tenantId: "t1", type: "MOVE_IN", eventAt: moveIn1, source: "SYSTEM", createdAt: moveIn1 },
            { id: "e2", roomId: "r3", tenantId: "t2", type: "MOVE_OUT", eventAt: moveOut1, source: "SYSTEM", createdAt: moveOut1 },
          ]),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/metrics/occupancy/overview/route")
    const res = await route.GET(new Request(`http://localhost/api/metrics/occupancy/overview?month=${month}`, { headers: { accept: "application/vnd.apartment.v1.1+json" } }))
    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      success: boolean
      data: {
        periodMonth: string
        kpis: { totalRooms: number; occupiedRooms: number; vacantRooms: number; occupancyRate: number }
        monthly: { moveInCount: number; moveOutCount: number }
        trends: { moveInDaily: Array<{ date: string; count: number }>; moveOutDaily: Array<{ date: string; count: number }> }
      }
    }
    expect(json.success).toBe(true)
    expect(json.data.periodMonth).toBe(month)
    expect(json.data.kpis.totalRooms).toBe(3)
    expect(json.data.kpis.occupiedRooms).toBe(2)
    expect(json.data.kpis.vacantRooms).toBe(1)
    expect(json.data.kpis.occupancyRate).toBe(66.67)
    expect(json.data.monthly.moveInCount).toBe(1)
    expect(json.data.monthly.moveOutCount).toBe(1)
    const mi = json.data.trends.moveInDaily.find((x) => x.date === "2026-02-05")
    const mo = json.data.trends.moveOutDaily.find((x) => x.date === "2026-02-10")
    expect(mi?.count).toBe(1)
    expect(mo?.count).toBe(1)
  })
})

