import { describe, it, expect, vi, beforeEach } from "vitest"
import { z } from "zod"
import { PATCH as RoomsStatusPATCH } from "@/app/api/admin/rooms/[id]/status/route"
import { Room } from "@/domain/entities/Room"

vi.mock("@/infrastructure/db/prisma/repositories/PrismaRoomRepository", () => {
  class PrismaRoomRepository {
    async update(id: string, patch: { status?: string }): Promise<Room> {
      if (!id || id.trim().length === 0) throw new Error("Invalid id")
      const allowed = ["AVAILABLE", "OCCUPIED", "MAINTENANCE"]
      if (!patch.status || !allowed.includes(patch.status)) throw new Error("Invalid status")
      return new Room(id, "101", patch.status, 2)
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

describe("Rooms Status PATCH", () => {
  it("legacy success", async () => {
    const ctx = { params: Promise.resolve({ id: "room-1" }) }
    const req = makeReq("http://localhost/api/admin/rooms/room-1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "AVAILABLE" }),
    }, { "content-type": "application/json" })
    const res = await RoomsStatusPATCH(req, ctx)
    expect(res.status).toBe(200)
    assertHeaders(res)
    const json = await res.json()
    RoomDTO.parse(json)
    expect(json.status).toBe("AVAILABLE")
  })

  it("envelope success", async () => {
    const ctx = { params: Promise.resolve({ id: "room-2" }) }
    const req = makeReq("http://localhost/api/admin/rooms/room-2/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "OCCUPIED" }),
    }, { "content-type": "application/json", accept: AcceptEnvelope })
    const res = await RoomsStatusPATCH(req, ctx)
    expect(res.status).toBe(200)
    assertHeaders(res)
    const json = await res.json()
    EnvelopeSuccess(RoomDTO).parse(json)
    expect(json.data.status).toBe("OCCUPIED")
  })

  it("invalid status → 400 VALIDATION_ERROR (legacy)", async () => {
    const ctx = { params: Promise.resolve({ id: "room-3" }) }
    const req = makeReq("http://localhost/api/admin/rooms/room-3/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "INVALID" }),
    }, { "content-type": "application/json" })
    const res = await RoomsStatusPATCH(req, ctx)
    expect(res.status).toBe(400)
    assertHeaders(res)
    const json = await res.json()
    LegacyError.parse(json)
    expect(json.code).toBe("VALIDATION_ERROR")
  })

  it("invalid id → 400 VALIDATION_ERROR (envelope)", async () => {
    const ctx = { params: Promise.resolve({ id: "" }) }
    const req = makeReq("http://localhost/api/admin/rooms//status", {
      method: "PATCH",
      body: JSON.stringify({ status: "AVAILABLE" }),
    }, { "content-type": "application/json", accept: AcceptEnvelope })
    const res = await RoomsStatusPATCH(req, ctx)
    expect(res.status).toBe(400)
    assertHeaders(res)
    const json = await res.json()
    EnvelopeError.parse(json)
    expect(json.error.code).toBe("VALIDATION_ERROR")
  })
})
