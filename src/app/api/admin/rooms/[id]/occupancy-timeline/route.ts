import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { ValidationError } from "@/interface/errors/ValidationError"
import { PrismaRoomTimelineReader } from "@/infrastructure/readers/PrismaRoomTimelineReader"
import { GetRoomOccupancyTimelineUseCase } from "@/domain/usecases/room/get-room-occupancy-timeline.usecase"
import { presentRoomTimelineItem } from "@/interface/presenters/room-timeline.presenter"

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const { id } = await ctx.params
  const url = new URL(req.url)
  const month = url.searchParams.get("month")
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new ValidationError("Invalid month format, expected YYYY-MM")
  }
  const reader = new PrismaRoomTimelineReader()
  const usecase = new GetRoomOccupancyTimelineUseCase(reader)
  const items = await usecase.execute({ roomId: id, month })
  const data = items.map(presentRoomTimelineItem)
  return respondOk(req, data, 200)
})
