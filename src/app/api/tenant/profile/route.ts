import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import type { TenantProfileDTO } from "@/application/dto/tenant-profile.dto"

export const runtime = "nodejs"

const FRESHNESS_THRESHOLD_MS = 15 * 60 * 1000

function isStale(calculatedAt: Date): boolean {
  const now = new Date()
  return now.getTime() - calculatedAt.getTime() > FRESHNESS_THRESHOLD_MS
}

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  const session = await requireRole(req, ["TENANT"])
  const calculatedAt = new Date()
  let tenantId: string | null = null
  tenantId = session.userId || null
  let tenant = null as null | { id: string; roomId: string | null }
  if (tenantId) {
    tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, roomId: true } })
    if (!tenant) {
      tenant = await prisma.tenant.findFirst({ where: { lineUserId: tenantId }, select: { id: true, roomId: true } })
    }
  }
  let room: { id: string; number: string; status: "OCCUPIED" | "AVAILABLE" | "MAINTENANCE" } | null = null
  if (tenant?.roomId) {
    const r = await prisma.room.findUnique({ where: { id: tenant.roomId }, select: { id: true, roomNumber: true, status: true } })
    if (r) {
      room = { id: r.id, number: r.roomNumber, status: String(r.status) as "OCCUPIED" | "AVAILABLE" | "MAINTENANCE" }
    }
  }
  let contract: { startDate: string; endDate: string | null } | null = null
  if (tenant?.id) {
    const reg = await prisma.tenantRegistration.findFirst({
      where: { tenantId: tenant.id, status: "ACTIVE" },
      orderBy: { approvedAt: "desc" },
      select: { approvedAt: true },
    })
    if (reg?.approvedAt instanceof Date) {
      contract = { startDate: reg.approvedAt.toISOString(), endDate: null }
    }
  }
  const freshnessMs = Math.max(0, new Date().getTime() - calculatedAt.getTime())
  const missing = !room || !contract
  const status: TenantProfileDTO["meta"]["status"] = missing ? "PARTIAL" : isStale(calculatedAt) ? "STALE" : "OK"
  const reason = missing ? "missing room or contract" : undefined
  const payload: TenantProfileDTO = {
    room,
    contract,
    meta: { status, calculatedAt: calculatedAt.toISOString(), freshnessMs, reason },
  }
  return respondOk<TenantProfileDTO>(req, payload, 200)
})
