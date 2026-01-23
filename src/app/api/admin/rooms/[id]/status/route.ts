import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { PrismaRoomRepository } from "@/infrastructure/db/prisma/repositories/PrismaRoomRepository"
import { presentRoomDTO } from "@/interface/presenters/room.presenter"
import { ValidationError } from "@/interface/errors/ValidationError"
import type { RoomStatus } from "@/domain/value-objects/RoomStatus"
import type { Room } from "@/domain/entities/Room"

export const runtime = "nodejs"

export const PATCH = withErrorHandling(
  async (req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> => {
    await requireRole(req, ["ADMIN"])
    const { id } = await context.params
    if (!id || id.trim().length === 0) {
      throw new ValidationError("Invalid room id")
    }
    const body = (await req.json()) as { status?: string }
    const statusParam = body?.status
    const status: RoomStatus | undefined =
      statusParam === "AVAILABLE" || statusParam === "OCCUPIED" || statusParam === "MAINTENANCE"
        ? (statusParam as RoomStatus)
        : undefined
    if (!status) {
      throw new ValidationError("Invalid status")
    }
    const repo = new PrismaRoomRepository()
    const updated = await repo.update(id, { status })
    const dto = presentRoomDTO(updated as Room)
    return respondOk(req, dto, 200)
  },
)
