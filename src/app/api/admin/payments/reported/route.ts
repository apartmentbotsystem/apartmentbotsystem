import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import type { ReportedPaymentListDTO } from "@/application/dto/reported-payment.dto"
import { correlateReportedPayment } from "@/application/helpers/reported-payment.helper"

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  type AuditRow = { action: string; timestamp: Date; targetId: string | null; actorId: string | null; metadata?: Record<string, unknown> | null }
  const client = prisma as unknown as {
    auditEvent?: { findMany: (args: unknown) => Promise<AuditRow[]> }
  } & { findMany?: (args: unknown) => Promise<AuditRow[]> }
  const rows = client.auditEvent?.findMany
    ? await client.auditEvent.findMany({
        where: { action: "PAYMENT_REPORTED" },
        orderBy: { timestamp: "desc" },
        take: 500,
      })
    : client.findMany
    ? await client.findMany({
        where: { action: "PAYMENT_REPORTED" },
        orderBy: { timestamp: "desc" },
        take: 500,
      })
    : []
  const items: Array<Awaited<ReturnType<typeof correlateReportedPayment>>> = []
  for (const r of rows) {
    try {
      const dto = await correlateReportedPayment({
        targetId: r.targetId,
        tenantId: r.actorId ?? null,
        timestamp: r.timestamp,
        metadata: (r.metadata ?? null) as Record<string, unknown> | null,
      })
      if (dto) items.push(dto)
    } catch {
    }
  }
  const payload: ReportedPaymentListDTO = { items }
  return respondOk<ReportedPaymentListDTO>(req, payload, 200)
})
