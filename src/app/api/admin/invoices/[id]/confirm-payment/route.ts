import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk, respondError } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { emitAuditEvent } from "@/infrastructure/audit/audit.service"
import { assertInvoiceTransition } from "@/domain/invoice-status"
import { ValidationError } from "@/interface/errors/ValidationError"
import { logger } from "@/interface/logger/logger"
import { buildRequestMeta } from "@/interface/http/request-context"

export const runtime = "nodejs"

export const POST = withErrorHandling(async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const session = await requireRole(req, ["ADMIN"])
  const { id } = await ctx.params
  const meta = buildRequestMeta(req)
  const body = (await req.json().catch(() => ({}))) as { paymentNote?: string | null }
  const idemKey = req.headers.get("x-idempotency-key")
  const endpoint = "/api/admin/invoices/[id]/confirm-payment"
  const requestHash = JSON.stringify({ id, paymentNote: body?.paymentNote ?? null })
  if (idemKey) {
    const existing = await prisma.idempotencyKey.findFirst({ where: { key: idemKey, endpoint } })
    if (existing) {
      if (existing.requestHash !== requestHash) {
        logger.warn({ requestId: meta.requestId, method: meta.method, path: meta.path, status: 409, userId: meta.userId, role: meta.role })
        return respondError(req, "IDEMPOTENCY_KEY_MISMATCH", "Idempotency key reuse with different request", 409)
      }
      logger.info({ requestId: meta.requestId, method: meta.method, path: meta.path, status: 200, userId: meta.userId, role: meta.role })
      return respondOk(req, existing.responseSnapshot as unknown as Record<string, unknown>, 200)
    }
  }
  const invoice = await prisma.invoice.findUnique({ where: { id } })
  if (!invoice) {
    logger.warn({ requestId: meta.requestId, method: meta.method, path: meta.path, status: 404, userId: meta.userId, role: meta.role })
    return respondError(req, "INVOICE_NOT_FOUND", "Invoice not found", 404)
  }
  const cur = String(invoice.status)
  if (cur !== "SENT") {
    logger.warn({ requestId: meta.requestId, method: meta.method, path: meta.path, status: 400, userId: meta.userId, role: meta.role })
    return respondError(req, "INVALID_STATUS", "Invoice is not in SENT status", 400)
  }
  assertInvoiceTransition("SENT", "PAID")
  const note = body?.paymentNote && String(body.paymentNote).trim().length > 0 ? String(body.paymentNote) : null
  await prisma.$transaction(async (tx) => {
    try {
      // lock the invoice row to prevent concurrent confirmations
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyTx = tx as any
      if (typeof anyTx.$queryRaw === "function") {
        await anyTx.$queryRaw`SELECT id FROM "Invoice" WHERE id=${id} FOR UPDATE`
      }
    } catch {
    }
    const fresh = await tx.invoice.findUnique({ where: { id } })
    if (!fresh || String(fresh.status) !== "SENT") {
      throw new ValidationError("Invoice is not in SENT status")
    }
    const paidAt = new Date()
    await tx.invoice.update({
      where: { id },
      data: { status: "PAID", paidAt, paymentNote: note },
    })
    try {
      await tx.adminAuditLog.create({
        data: {
          action: "INVOICE_PAID",
          adminId: session.userId || "",
          tenantRegistrationId: "",
          tenantId: invoice.tenantId,
          lineUserId: invoice.tenantId ? (await tx.tenant.findUnique({ where: { id: invoice.tenantId }, select: { lineUserId: true } }))?.lineUserId ?? null : null,
        },
      })
    } catch {
    }
  })
  emitAuditEvent({
    actorType: "ADMIN",
    actorId: session.userId,
    action: "INVOICE_PAID",
    targetType: "INVOICE",
    targetId: id,
    severity: "INFO",
    metadata: { invoiceId: id, periodMonth: invoice.periodMonth },
  })
  const payload = { id, status: "PAID" }
  if (idemKey) {
    try {
      await prisma.idempotencyKey.create({
        data: { key: idemKey, endpoint, requestHash, responseSnapshot: payload },
      })
    } catch {
    }
  }
  logger.info({ requestId: meta.requestId, method: meta.method, path: meta.path, status: 200, userId: meta.userId, role: meta.role })
  return respondOk(req, payload, 200)
})
