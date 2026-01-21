import { getCreateInvoiceUseCase } from "@/infrastructure/di/container"
import { presentInvoiceDTO } from "@/interface/presenters/invoice.presenter"
import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { createInvoiceSchema } from "@/interface/validators/invoice.schema"
import { ValidationError } from "@/interface/errors/ValidationError"
import { respondOk } from "@/interface/http/response"

export const POST = withErrorHandling(async (req: Request): Promise<Response> => {
  const body = await req.json()
  const parsed = createInvoiceSchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError("Invalid invoice input")
  }
  const usecase = getCreateInvoiceUseCase()
  const result = await usecase.execute({
    roomId: parsed.data.roomId,
    tenantId: parsed.data.tenantId,
    amount: parsed.data.amount,
    month: parsed.data.month,
  })
  return respondOk(req, presentInvoiceDTO(result), 201)
})
