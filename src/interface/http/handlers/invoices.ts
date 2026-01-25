import { getCreateInvoiceUseCase } from "@/infrastructure/di/container"
import { presentInvoiceDTO } from "@/interface/presenters/invoice.presenter"
import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { createInvoiceSchema } from "@/interface/validators/invoice.schema"
import { ValidationError } from "@/interface/errors/ValidationError"
import { respondOk } from "@/interface/http/response"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { requireRole } from "@/lib/guards"
import { emitAuditEvent } from "@/infrastructure/audit/audit.service"

export const POST = withErrorHandling(async (req: Request): Promise<Response> => {
  const session = await requireRole(req, ["ADMIN"])
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
  emitAuditEvent({
    actorType: session.role === "ADMIN" || session.role === "STAFF" ? session.role : "SYSTEM",
    actorId: session.userId,
    action: "INVOICE_CREATED",
    targetType: "INVOICE",
    targetId: result.id,
    severity: "INFO",
    metadata: { roomId: parsed.data.roomId, tenantId: parsed.data.tenantId, amount: parsed.data.amount, month: parsed.data.month },
  })
  return respondOk(req, presentInvoiceDTO(result), 201)
})

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN", "STAFF"])
  const url = new URL(req.url)
  const status = url.searchParams.get("status") || undefined
  const limit = Number(url.searchParams.get("limit") || "50")
  const take = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 50
  const where: Record<string, unknown> = {}
  if (status) {
    const mapped = status === "UNPAID" ? "ISSUED" : status
    where.status = mapped
  }
  const rows = await prisma.invoice.findMany({
    where,
    orderBy: { issuedAt: "desc" },
    take,
  })
  type InvoiceRow = Awaited<ReturnType<typeof prisma.invoice.findMany>>[number]
  const data = rows.map((r: InvoiceRow) => ({
    id: r.id,
    roomId: r.roomId,
    tenantId: r.tenantId,
    amount: Number(r.totalAmount),
    month: r.periodMonth,
    dueDate: r.dueDate ? new Date(r.dueDate).toISOString().slice(0, 10) : undefined,
    status: r.status,
  }))
  return respondOk(req, data, 200)
})
