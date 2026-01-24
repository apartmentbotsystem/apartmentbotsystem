import { describe, it, expect, vi, beforeEach } from "vitest"
import { z } from "zod"
import { GET as TimelineGET } from "@/app/api/rooms/occupancy-timeline/route"

vi.mock("@/infrastructure/db/prisma/repositories/PrismaRoomRepository", () => {
  class PrismaRoomRepository {
    async getRoomsOccupancyTimeline(
      roomId?: string,
    ): Promise<
      Array<{
        roomId: string
        tenantId: string | null
        startDate: Date
        endDate: Date | null
        status: "occupied" | "vacant"
      }>
    > {
      if (roomId === "empty") return []
      if (!roomId) {
        return [
          { roomId: "r-101", tenantId: null, startDate: new Date("2026-01-02T00:00:00Z"), endDate: new Date("2026-01-12T00:00:00Z"), status: "occupied" },
          { roomId: "r-101", tenantId: null, startDate: new Date("2026-01-12T00:00:00Z"), endDate: new Date("2026-01-15T00:00:00Z"), status: "vacant" },
          { roomId: "r-101", tenantId: null, startDate: new Date("2026-01-15T00:00:00Z"), endDate: null, status: "occupied" },
        ]
      }
      return [
        { roomId, tenantId: null, startDate: new Date("2026-01-03T00:00:00Z"), endDate: null, status: "occupied" },
      ]
    }
  }
  return { PrismaRoomRepository }
})

function makeReq(url: string, init?: RequestInit, headers?: Record<string, string>) {
  const h = new Headers(init?.headers || {})
  if (headers) for (const [k, v] of Object.entries(headers)) h.set(k, v)
  return new Request(url, { ...init, headers: h })
}

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

const ItemDTO = z.object({
  roomId: z.string(),
  tenantId: z.string().nullable(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  status: z.enum(["occupied", "vacant"]),
})

function assertHeaders(res: Response) {
  expect(res.headers.get("content-type")).toContain("application/json")
  expect(res.headers.get("x-request-id")).toBeTypeOf("string")
  expect(res.headers.get("x-response-time")).toBeTypeOf("string")
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe("Rooms Occupancy Timeline READ GET", () => {
  it("empty result", async () => {
    const req = makeReq("http://localhost/api/rooms/occupancy-timeline?roomId=empty", { method: "GET" })
    const res = await TimelineGET(req)
    expect(res.status).toBe(200)
    assertHeaders(res)
    const json = await res.json()
    expect(Array.isArray(json)).toBe(true)
    expect(json.length).toBe(0)
  })

  it("single occupancy", async () => {
    const req = makeReq(
      "http://localhost/api/rooms/occupancy-timeline?roomId=r-102",
      { method: "GET" },
      { accept: AcceptEnvelope },
    )
    const res = await TimelineGET(req)
    expect(res.status).toBe(200)
    assertHeaders(res)
    const json = await res.json()
    const EnvelopeSuccess = z.object({ success: z.literal(true), data: z.array(ItemDTO) })
    EnvelopeSuccess.parse(json)
    expect(json.data.length).toBe(1)
    expect(json.data[0].status).toBe("occupied")
    expect(json.data[0].endDate).toBeNull()
  })

  it("overlapping records handling (read-only)", async () => {
    const req = makeReq("http://localhost/api/rooms/occupancy-timeline", { method: "GET" }, { accept: AcceptEnvelope })
    const res = await TimelineGET(req)
    expect(res.status).toBe(200)
    assertHeaders(res)
    const json = await res.json()
    const EnvelopeSuccess = z.object({ success: z.literal(true), data: z.array(ItemDTO) })
    EnvelopeSuccess.parse(json)
    expect(json.data.length).toBeGreaterThan(2)
    const statuses = json.data.map((x: unknown) => ItemDTO.parse(x).status)
    expect(statuses).toContain("occupied")
    expect(statuses).toContain("vacant")
  })
})
