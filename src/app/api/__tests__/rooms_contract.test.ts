import { describe, it, expect, vi, beforeEach } from "vitest"
import { z } from "zod"
import { GET as RoomsGET } from "@/app/api/rooms/route"
import { Room } from "@/domain/entities/Room"

vi.mock("@/infrastructure/db/prisma/repositories/PrismaRoomRepository", () => {
  class PrismaRoomRepository {
    async findAll(filter?: { status?: string; numberContains?: string }): Promise<Room[]> {
      const data = [
        new Room("r-101", "101", "AVAILABLE", 2),
        new Room("r-102", "102", "OCCUPIED", 3),
        new Room("r-103", "103", "MAINTENANCE", 1),
      ]
      const byStatus = filter?.status
        ? data.filter((r) => r.status === filter.status)
        : data
      const byNumber = filter?.numberContains
        ? byStatus.filter((r) => r.number.includes(filter.numberContains as string))
        : byStatus
      return byNumber
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

const RoomDTO = z.object({
  id: z.string(),
  number: z.string(),
  status: z.string(),
  maxOccupants: z.number(),
})

const LegacyError = z.object({
  code: z.string(),
  message: z.string(),
})

const EnvelopeSuccess = (schema: z.ZodTypeAny) =>
  z.object({
    success: z.literal(true),
    data: z.array(schema),
  })

const EnvelopeError = z.object({
  success: z.literal(false),
  error: LegacyError,
})

function assertHeaders(res: Response) {
  expect(res.headers.get("content-type")).toContain("application/json")
  expect(res.headers.get("x-request-id")).toBeTypeOf("string")
  expect(res.headers.get("x-response-time")).toBeTypeOf("string")
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe("Rooms GET", () => {
  it("legacy success: returns array of DTO", async () => {
    const req = makeReq("http://localhost/api/rooms", { method: "GET" })
    const res = await RoomsGET(req)
    expect(res.status).toBe(200)
    assertHeaders(res)
    const json = await res.json()
    expect(Array.isArray(json)).toBe(true)
    json.forEach((item: unknown) => RoomDTO.parse(item))
    expect(json).toMatchSnapshot("rooms-legacy-success")
  })

  it("envelope success: wraps array of DTO", async () => {
    const req = makeReq("http://localhost/api/rooms", { method: "GET" }, { accept: AcceptEnvelope })
    const res = await RoomsGET(req)
    expect(res.status).toBe(200)
    assertHeaders(res)
    const json = await res.json()
    EnvelopeSuccess(RoomDTO).parse(json)
    expect(json).toMatchSnapshot("rooms-envelope-success")
  })

  it("filter by valid status", async () => {
    const req = makeReq("http://localhost/api/rooms?status=AVAILABLE", { method: "GET" })
    const res = await RoomsGET(req)
    expect(res.status).toBe(200)
    assertHeaders(res)
    const json = await res.json()
    json.forEach((item: unknown) => {
      RoomDTO.parse(item)
      expect((item as { status: string }).status).toBe("AVAILABLE")
    })
  })

  it("invalid status → 400 VALIDATION_ERROR (legacy)", async () => {
    const req = makeReq("http://localhost/api/rooms?status=INVALID", { method: "GET" })
    const res = await RoomsGET(req)
    expect(res.status).toBe(400)
    assertHeaders(res)
    const json = await res.json()
    LegacyError.parse(json)
    expect(json.code).toBe("VALIDATION_ERROR")
  })

  it("limit parameter respected (envelope)", async () => {
    const req = makeReq("http://localhost/api/rooms?limit=2", { method: "GET" }, { accept: AcceptEnvelope })
    const res = await RoomsGET(req)
    expect(res.status).toBe(200)
    assertHeaders(res)
    const json = await res.json()
    EnvelopeSuccess(RoomDTO).parse(json)
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data.length).toBeLessThanOrEqual(2)
  })

  it("invalid status → 400 VALIDATION_ERROR (envelope)", async () => {
    const req = makeReq("http://localhost/api/rooms?status=INVALID", { method: "GET" }, { accept: AcceptEnvelope })
    const res = await RoomsGET(req)
    expect(res.status).toBe(400)
    assertHeaders(res)
    const json = await res.json()
    EnvelopeError.parse(json)
    expect(json.error.code).toBe("VALIDATION_ERROR")
  })
})
