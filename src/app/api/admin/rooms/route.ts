import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const url = new URL(req.url)
  const status = (url.searchParams.get("status") || "AVAILABLE") as "AVAILABLE" | "OCCUPIED" | "MAINTENANCE"
  const rows = await prisma.room.findMany({
    where: status ? { status } : undefined,
    orderBy: { roomNumber: "asc" },
    select: { id: true, roomNumber: true, status: true },
    take: 500,
  })
  return respondOk(req, rows, 200)
})
