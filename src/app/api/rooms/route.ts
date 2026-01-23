import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { PrismaRoomRepository } from "@/infrastructure/db/prisma/repositories/PrismaRoomRepository"
import { requireRole } from "@/lib/guards"
import { presentRoomDTO } from "@/interface/presenters/room.presenter"
import type { Room } from "@/domain/entities/Room"
import type { RoomStatus } from "@/domain/value-objects/RoomStatus"
import { ValidationError } from "@/interface/errors/ValidationError"

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN", "STAFF"])
  const url = new URL(req.url)
  const statusParam = url.searchParams.get("status") || undefined
  const status: RoomStatus | undefined =
    statusParam === "AVAILABLE" || statusParam === "OCCUPIED" || statusParam === "MAINTENANCE"
      ? (statusParam as RoomStatus)
      : undefined
  if (statusParam && !status) {
    throw new ValidationError("Invalid status")
  }
  const numberContains = url.searchParams.get("number") || undefined
  const limitNum = Number(url.searchParams.get("limit") || "50")
  const take = Number.isFinite(limitNum) && limitNum > 0 ? Math.min(limitNum, 200) : 50
  const repo = new PrismaRoomRepository()
  const rows = await repo.findAll({ status, numberContains })
  const data = rows.slice(0, take).map((r: Room) => presentRoomDTO(r))
  return respondOk(req, data, 200)
})
