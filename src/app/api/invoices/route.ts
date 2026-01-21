import { getCreateInvoiceUseCase } from "@/infrastructure/di/container"
import { presentInvoiceDTO } from "@/interface/presenters/invoice.presenter"

export async function POST(req: Request): Promise<Response> {
  const body = await req.json()
  const usecase = getCreateInvoiceUseCase()
  const result = await usecase.execute({
    roomId: String(body.roomId),
    tenantId: String(body.tenantId),
    amount: Number(body.amount),
    month: String(body.month),
  })
  return Response.json(presentInvoiceDTO(result), { status: 201 })
}
