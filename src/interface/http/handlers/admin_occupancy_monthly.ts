import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { ValidationError } from "@/interface/errors/ValidationError"
import { PrismaRoomRepository } from "@/infrastructure/db/prisma/repositories/PrismaRoomRepository"
import { presentAdminMonthlyItem } from "@/interface/presenters/admin-occupancy-monthly.presenter"

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const url = new URL(req.url)
  const month = url.searchParams.get("month")
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new ValidationError("Invalid month format, expected YYYY-MM")
  }
  const repo = new PrismaRoomRepository()
  const rows = await repo.getAdminMonthlyOccupancyDashboard(month)
  const data = rows.map((it: { roomId: string; totalOccupiedDays: number; occupancyRate: number; firstOccupiedAt: Date | null; lastVacatedAt: Date | null }) =>
    presentAdminMonthlyItem(it),
  )
  return respondOk(req, data, 200)
})
