import { getRecordPaymentUseCase } from "@/infrastructure/di/container"
import { presentPaymentDTO } from "@/interface/presenters/payment.presenter"

export const runtime = "nodejs"

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}))
  const invoiceId = String(body.invoiceId)
  const method = String(body.method)
  const reference = body.reference ? String(body.reference) : null
  if (!invoiceId || !method) {
    return new Response(JSON.stringify({ error: "invoiceId and method required" }), { status: 400 })
  }
  const usecase = getRecordPaymentUseCase()
  const result = await usecase.execute({ invoiceId, method, reference })
  return Response.json(presentPaymentDTO(result), { status: 201 })
}

