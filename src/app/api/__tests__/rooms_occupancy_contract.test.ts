import { describe, it, expect, vi, beforeEach } from "vitest"
import { z } from "zod"
import { POST as OccupyPOST } from "@/app/api/admin/rooms/[id]/occupy/route"
import { POST as VacatePOST } from "@/app/api/admin/rooms/[id]/vacate/route"
import { Room } from "@/domain/entities/Room"
import { httpError } from "@/interface/errors/HttpError"
import { ErrorCodes } from "@/interface/errors/error-codes"
import { ValidationError } from "@/interface/errors/ValidationError"

vi.mock("@/infrastructure/db/prisma/repositories/PrismaRoomRepository", () => {
  class PrismaRoomRepository {
    async startOccupancy(id: string): Promise<Room> {
      if (!id || id.trim().length === 0) throw new ValidationError("Invalid room id")
      if (id === "occupied-room") throw httpError(ErrorCodes.ROOM_NOT_AVAILABLE, "Room not available")
      return new Room(id, "101", "OCCUPIED", 2)
    }
    async endOccupancy(id: string): Promise<Room> {
      if (!id || id.trim().length === 0) throw new ValidationError("Invalid room id")
      if (id === "available-room") throw new ValidationError("Invalid room state")
      return new Room(id, "101", "AVAILABLE", 2)
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
    data: schema,
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

describe("Rooms Occupancy Lifecycle", () => {
  it("occupy success (legacy)", async () => {
    const ctx = { params: Promise.resolve({ id: "room-1" }) }
    const req = makeReq("http://localhost/api/admin/rooms/room-1/occupy", { method: "POST" })
    const res = await OccupyPOST(req, ctx)
    expect(res.status).toBe(200)
    assertHeaders(res)
    const json = await res.json()
    RoomDTO.parse(json)
    expect(json.status).toBe("OCCUPIED")
  })

  it("occupy success (envelope)", async () => {
    const ctx = { params: Promise.resolve({ id: "room-2" }) }
    const req = makeReq("http://localhost/api/admin/rooms/room-2/occupy", { method: "POST" }, { accept: AcceptEnvelope })
    const res = await OccupyPOST(req, ctx)
    expect(res.status).toBe(200)
    assertHeaders(res)
    const json = await res.json()
    EnvelopeSuccess(RoomDTO).parse(json)
    expect(json.data.status).toBe("OCCUPIED")
  })

  it("occupy invalid state (OCCUPIED) → error", async () => {
    const ctx = { params: Promise.resolve({ id: "occupied-room" }) }
    const req = makeReq("http://localhost/api/admin/rooms/occupied-room/occupy", { method: "POST" }, { accept: AcceptEnvelope })
    const res = await OccupyPOST(req, ctx)
    expect(res.status).toBe(409)
    assertHeaders(res)
    const json = await res.json()
    EnvelopeError.parse(json)
    expect(json.error.code).toBe("ROOM_NOT_AVAILABLE")
  })

  it("vacate success (legacy)", async () => {
    const ctx = { params: Promise.resolve({ id: "room-3" }) }
    const req = makeReq("http://localhost/api/admin/rooms/room-3/vacate", { method: "POST" })
    const res = await VacatePOST(req, ctx)
    expect(res.status).toBe(200)
    assertHeaders(res)
    const json = await res.json()
    RoomDTO.parse(json)
    expect(json.status).toBe("AVAILABLE")
  })

  it("vacate success (envelope)", async () => {
    const ctx = { params: Promise.resolve({ id: "room-4" }) }
    const req = makeReq("http://localhost/api/admin/rooms/room-4/vacate", { method: "POST" }, { accept: AcceptEnvelope })
    const res = await VacatePOST(req, ctx)
    expect(res.status).toBe(200)
    assertHeaders(res)
    const json = await res.json()
    EnvelopeSuccess(RoomDTO).parse(json)
    expect(json.data.status).toBe("AVAILABLE")
  })

  it("vacate invalid state (AVAILABLE) → error", async () => {
    const ctx = { params: Promise.resolve({ id: "available-room" }) }
    const req = makeReq("http://localhost/api/admin/rooms/available-room/vacate", { method: "POST" }, { accept: AcceptEnvelope })
    const res = await VacatePOST(req, ctx)
    expect(res.status).toBe(400)
    assertHeaders(res)
    const json = await res.json()
    EnvelopeError.parse(json)
    expect(json.error.code).toBe("VALIDATION_ERROR")
  })

  it("invalid room id → 400 VALIDATION_ERROR (legacy)", async () => {
    const ctx = { params: Promise.resolve({ id: "" }) }
    const req = makeReq("http://localhost/api/admin/rooms//occupy", { method: "POST" })
    const res = await OccupyPOST(req, ctx)
    expect(res.status).toBe(400)
    assertHeaders(res)
    const json = await res.json()
    LegacyError.parse(json)
    expect(json.code).toBe("VALIDATION_ERROR")
  })
})
