import { getRecordPaymentUseCase } from "@/infrastructure/di/container"
import { presentPaymentDTO } from "@/interface/presenters/payment.presenter"
import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { recordPaymentSchema } from "@/interface/validators/payment.schema"
import { ValidationError } from "@/interface/errors/ValidationError"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { emitAuditEvent } from "@/infrastructure/audit/audit.service"

export const POST = withErrorHandling(async (req: Request): Promise<Response> => {
  const session = await requireRole(req, ["ADMIN", "STAFF"])
  const body = await req.json().catch(() => ({}))
  const parsed = recordPaymentSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError("Invalid payment input")
  }
  const usecase = getRecordPaymentUseCase()
  const result = await usecase.execute({
    invoiceId: parsed.data.invoiceId,
    method: parsed.data.method,
    reference: parsed.data.reference ?? null,
  })
  emitAuditEvent({
    actorType: session.role === "ADMIN" || session.role === "STAFF" ? session.role : "SYSTEM",
    actorId: session.userId,
    action: "PAYMENT_CONFIRMED",
    targetType: "PAYMENT",
    targetId: result.id,
    severity: "INFO",
    metadata: { invoiceId: parsed.data.invoiceId, method: parsed.data.method },
  })
  return respondOk(req, presentPaymentDTO(result), 201)
})
