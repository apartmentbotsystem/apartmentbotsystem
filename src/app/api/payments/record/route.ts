import { getRecordPaymentUseCase } from "@/infrastructure/di/container"
import { presentPaymentDTO } from "@/interface/presenters/payment.presenter"
import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { recordPaymentSchema } from "@/interface/validators/payment.schema"
import { ValidationError } from "@/interface/errors/ValidationError"
import { respondOk } from "@/interface/http/response"

export const runtime = "nodejs"

export const POST = withErrorHandling(async (req: Request): Promise<Response> => {
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
  return respondOk(req, presentPaymentDTO(result), 201)
})
