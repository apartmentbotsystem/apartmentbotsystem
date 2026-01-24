import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { PrismaRoomRepository } from "@/infrastructure/db/prisma/repositories/PrismaRoomRepository"
import { presentOccupancyTimelineItem } from "@/interface/presenters/rooms-occupancy-timeline.presenter"
import { requireRole } from "@/lib/guards"
import { ValidationError } from "@/interface/errors/ValidationError"

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN", "STAFF"])
  const url = new URL(req.url)
  const roomId = url.searchParams.get("roomId") || undefined
  if (roomId && roomId.trim().length === 0) {
    throw new ValidationError("Invalid room id")
  }
  const repo = new PrismaRoomRepository()
  const rows = await repo.getRoomsOccupancyTimeline(roomId)
  const data: Array<ReturnType<typeof presentOccupancyTimelineItem>> = rows.map((item) =>
    presentOccupancyTimelineItem(item),
  )
  return respondOk(req, data, 200)
})
