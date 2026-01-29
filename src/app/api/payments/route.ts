import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { PrismaPaymentRepository } from "@/infrastructure/db/prisma/repositories/PrismaPaymentRepository"
import { presentPaymentDTO } from "@/interface/presenters/payment.presenter"
import { requireRole } from "@/lib/guards"
import type { Payment } from "@/domain/entities/Payment"
import { logger } from "@/interface/logger/logger"
import { buildRequestMeta } from "@/interface/http/request-context"

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN", "STAFF"])
  const url = new URL(req.url)
  const invoiceId = url.searchParams.get("invoiceId") || undefined
  const method = url.searchParams.get("method") || undefined
  const paidAfterStr = url.searchParams.get("paidAfter") || undefined
  const paidBeforeStr = url.searchParams.get("paidBefore") || undefined
  const repo = new PrismaPaymentRepository()
  const meta = buildRequestMeta(req)
  const filter: {
    invoiceId?: string
    method?: string
    paidAfter?: Date
    paidBefore?: Date
  } = {}
  if (invoiceId) filter.invoiceId = invoiceId
  if (method) filter.method = method
  if (paidAfterStr) {
    const d = new Date(paidAfterStr)
    if (!Number.isNaN(d.getTime())) filter.paidAfter = d
  }
  if (paidBeforeStr) {
    const d = new Date(paidBeforeStr)
    if (!Number.isNaN(d.getTime())) filter.paidBefore = d
  }
  const rows = await repo.findAll(filter)
  const data = rows.map((p: Payment) => presentPaymentDTO(p))
  logger.info({
    requestId: meta.requestId,
    method: meta.method,
    path: meta.path,
    status: 200,
    userId: meta.userId,
    role: meta.role,
  })
  return respondOk(req, data, 200)
})
