import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const rows = await prisma.tenantRegistration.findMany({
    where: { status: "PENDING" },
    include: { room: true, tenant: true },
    orderBy: { createdAt: "asc" },
    take: 500,
  })
  type Row = Awaited<ReturnType<typeof prisma.tenantRegistration.findMany>>[number]
  const data = rows.map((r: Row) => ({
    id: r.id,
    lineUserId: r.lineUserId,
    room: r.room ? { id: r.room.id, roomNumber: r.room.roomNumber } : null,
    tenant: r.tenant ? { id: r.tenant.id, name: r.tenant.name } : null,
    createdAt: r.createdAt.toISOString(),
  }))
  return respondOk(req, data, 200)
})
