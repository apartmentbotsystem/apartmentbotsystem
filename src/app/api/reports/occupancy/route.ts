import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { requireRole } from "@/lib/guards"

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN", "STAFF"])
  const totalRooms = await prisma.room.count()
  const occupiedRooms = await prisma.room.count({ where: { status: "OCCUPIED" } })
  const availableRooms = await prisma.room.count({ where: { status: "AVAILABLE" } })
  const occupancyRate = totalRooms > 0 ? occupiedRooms / totalRooms : 0
  const data = { totalRooms, occupiedRooms, availableRooms, occupancyRate }
  return respondOk(req, data, 200)
})
