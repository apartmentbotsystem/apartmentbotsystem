import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { PrismaTenantRepository } from "@/infrastructure/db/prisma/repositories/PrismaTenantRepository"
import { presentTenantDTO } from "@/interface/presenters/tenant.presenter"
import { requireRole } from "@/lib/guards"

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN", "STAFF"])
  const url = new URL(req.url)
  const roomId = url.searchParams.get("roomId") || undefined
  const role = url.searchParams.get("role") || undefined
  const nameContains = url.searchParams.get("name") || undefined
  const repo = new PrismaTenantRepository()
  const rows = await repo.findAll({ roomId, role, nameContains })
  const data = rows.map((t) => presentTenantDTO(t))
  return respondOk(req, data, 200)
})
