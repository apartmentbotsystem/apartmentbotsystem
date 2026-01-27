import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { ValidationError } from "@/interface/errors/ValidationError"
import { generateInvoicePdf } from "@/lib/pdf/invoicePdf"

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const { id } = await ctx.params
  const row = await prisma.invoice.findUnique({
    where: { id },
    include: { tenant: true, room: true },
  })
  if (!row) {
    throw new ValidationError("Invoice not found")
  }
  const buf = await generateInvoicePdf({
    invoice: {
      id: row.id,
      periodMonth: row.periodMonth,
      rentAmount: Number(row.rentAmount),
      waterAmount: Number(row.waterAmount),
      electricAmount: Number(row.electricAmount),
      totalAmount: Number(row.totalAmount),
    },
    tenant: { name: row.tenant?.name || "" },
    room: { roomNumber: row.room?.roomNumber || "" },
  })
  const pdfBytes = new Uint8Array(buf)
  const blob = new Blob([pdfBytes], { type: "application/pdf" })
  return new Response(blob, {
    status: 200,
    headers: { "content-type": "application/pdf" },
  })
})
