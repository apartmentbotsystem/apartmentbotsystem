import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { PrismaRoomRepository } from "@/infrastructure/db/prisma/repositories/PrismaRoomRepository"
import { presentOccupancyDTO } from "@/interface/presenters/occupancy.presenter"
import { ValidationError } from "@/interface/errors/ValidationError"
import { RoomOccupancy } from "@/domain/entities/RoomOccupancy"

export const runtime = "nodejs"

export const GET = withErrorHandling(
  async (req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> => {
    await requireRole(req, ["ADMIN"])
    const { id } = await context.params
    if (!id || id.trim().length === 0) {
      throw new ValidationError("Invalid room id")
    }
    const repo = new PrismaRoomRepository()
    const rows = await repo.getOccupancyTimeline(id)
    const data = rows.map((r) => presentOccupancyDTO(new RoomOccupancy(r.id, id, r.startedAt, r.endedAt)))
    return respondOk(req, data, 200)
  },
)
