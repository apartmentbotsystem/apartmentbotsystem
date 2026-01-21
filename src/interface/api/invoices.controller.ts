import { CreateInvoiceUseCase } from "@/application/usecases/create-invoice.usecase"
import { presentInvoiceDTO } from "@/interface/presenters/invoice.presenter"

export class InvoicesController {
  constructor(private readonly createInvoice: CreateInvoiceUseCase) {}

  async create(req: Request): Promise<Response> {
    const body = await req.json()
    const result = await this.createInvoice.execute({
      roomId: String(body.roomId),
      tenantId: String(body.tenantId),
      amount: Number(body.amount),
      month: String(body.month),
    })
    return Response.json(presentInvoiceDTO(result), { status: 201 })
  }
}

