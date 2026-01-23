import { describe, it, expect, vi, beforeEach } from "vitest"
import { z } from "zod"
import { GET as OccupancyGET } from "@/app/api/admin/rooms/[id]/occupancy/route"
import { httpError } from "@/interface/errors/HttpError"
import { ErrorCodes } from "@/interface/errors/error-codes"

vi.mock("@/infrastructure/db/prisma/repositories/PrismaRoomRepository", () => {
  class PrismaRoomRepository {
    async getOccupancyTimeline(id: string): Promise<Array<{ id: string; startedAt: Date; endedAt: Date | null }>> {
      if (id === "not-found") {
        throw httpError(ErrorCodes.VALIDATION_ERROR, "Room not found")
      }
      return [
        { id: "occ-2", startedAt: new Date("2026-01-15T10:00:00Z"), endedAt: new Date("2026-01-20T10:00:00Z") },
        { id: "occ-1", startedAt: new Date("2026-01-01T08:00:00Z"), endedAt: null },
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

const OccupancyItemDTO = z.object({
  id: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
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

describe("Rooms Occupancy Timeline GET", () => {
  it("legacy success", async () => {
    const ctx = { params: Promise.resolve({ id: "room-1" }) }
    const req = makeReq("http://localhost/api/admin/rooms/room-1/occupancy", { method: "GET" })
    const res = await OccupancyGET(req, ctx)
    expect(res.status).toBe(200)
    assertHeaders(res)
    const json = await res.json()
    expect(Array.isArray(json)).toBe(true)
    json.forEach((item: unknown) => OccupancyItemDTO.parse(item))
  })

  it("envelope success", async () => {
    const ctx = { params: Promise.resolve({ id: "room-1" }) }
    const req = makeReq(
      "http://localhost/api/admin/rooms/room-1/occupancy",
      { method: "GET" },
      { accept: AcceptEnvelope },
    )
    const res = await OccupancyGET(req, ctx)
    expect(res.status).toBe(200)
    assertHeaders(res)
    const json = await res.json()
    EnvelopeSuccess(OccupancyItemDTO).parse(json)
  })

  it("invalid room id → 400 VALIDATION_ERROR (legacy)", async () => {
    const ctx = { params: Promise.resolve({ id: "" }) }
    const req = makeReq("http://localhost/api/admin/rooms//occupancy", { method: "GET" })
    const res = await OccupancyGET(req, ctx)
    expect(res.status).toBe(400)
    assertHeaders(res)
    const json = await res.json()
    LegacyError.parse(json)
    expect(json.code).toBe("VALIDATION_ERROR")
  })

  it("room not found → 400 VALIDATION_ERROR (envelope)", async () => {
    const ctx = { params: Promise.resolve({ id: "not-found" }) }
    const req = makeReq(
      "http://localhost/api/admin/rooms/not-found/occupancy",
      { method: "GET" },
      { accept: AcceptEnvelope },
    )
    const res = await OccupancyGET(req, ctx)
    expect(res.status).toBe(400)
    assertHeaders(res)
    const json = await res.json()
    EnvelopeError.parse(json)
    expect(json.error.code).toBe("VALIDATION_ERROR")
  })
})
