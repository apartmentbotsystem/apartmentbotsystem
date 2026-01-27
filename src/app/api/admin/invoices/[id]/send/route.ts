import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk, respondError } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { LineHttpClient } from "@/infrastructure/line/LineHttpClient"
import { generateInvoicePdf } from "@/lib/pdf/invoicePdf"
import { ValidationError } from "@/interface/errors/ValidationError"

export const runtime = "nodejs"

export const POST = withErrorHandling(async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const session = await requireRole(req, ["ADMIN"])
  const { id } = await ctx.params
  const idemKey = req.headers.get("x-idempotency-key")
  const endpoint = "/api/admin/invoices/[id]/send"
  const requestHash = JSON.stringify({ id })
  if (idemKey) {
    const existing = await prisma.idempotencyKey.findFirst({ where: { key: idemKey, endpoint } })
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return respondError(req, "IDEMPOTENCY_KEY_MISMATCH", "Idempotency key reuse with different request", 409)
      }
      return respondOk(req, existing.responseSnapshot as unknown as Record<string, unknown>, 200)
    }
  }
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { tenant: true, room: true },
  })
  if (!invoice) {
    return new Response(JSON.stringify({ code: "INVOICE_NOT_FOUND", message: "Invoice not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }
  if (invoice.status !== "DRAFT") {
    return new Response(JSON.stringify({ code: "VALIDATION_ERROR", message: "Invoice is not in DRAFT status" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }
  const to = invoice.tenant?.lineUserId || null
  if (!to) {
    return new Response(JSON.stringify({ code: "TENANT_LINE_NOT_BOUND", message: "Tenant does not have LINE user linked" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return new Response(JSON.stringify({ code: "VALIDATION_ERROR", message: "LINE access token not configured" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }
  const client = new LineHttpClient(token)
  await prisma.$transaction(async (tx) => {
    try {
      // lock the invoice row to prevent concurrent sends
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyTx = tx as any
      if (typeof anyTx.$queryRaw === "function") {
        await anyTx.$queryRaw`SELECT id FROM "Invoice" WHERE id=${id} FOR UPDATE`
      }
    } catch {
    }
    const fresh = await tx.invoice.findUnique({ where: { id }, include: { tenant: true, room: true } })
    if (!fresh || fresh.status !== "DRAFT") {
      throw new ValidationError("Invoice is not in DRAFT status")
    }
    const pdfBuffer = await generateInvoicePdf({
      invoice: {
        id: fresh.id,
        periodMonth: fresh.periodMonth,
        rentAmount: Number(fresh.rentAmount),
        waterAmount: Number(fresh.waterAmount),
        electricAmount: Number(fresh.electricAmount),
        totalAmount: Number(fresh.totalAmount),
      },
      tenant: { name: fresh.tenant?.name || "" },
      room: { roomNumber: fresh.room?.roomNumber || "" },
    })
    const pdfBytes = new Uint8Array(pdfBuffer)
    const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" })
    await client.uploadFile({ to, file: pdfBlob, filename: "invoice.pdf" })
    await tx.invoice.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
    })
    try {
      await tx.adminAuditLog.create({
        data: {
          action: "INVOICE_SENT",
          adminId: session.userId || "",
          tenantRegistrationId: "",
          tenantId: fresh.tenantId,
          lineUserId: to,
        },
      })
    } catch {
      // ignore audit failure
    }
  })
  const payload = { id, status: "SENT" }
  if (idemKey) {
    try {
      await prisma.idempotencyKey.create({
        data: { key: idemKey, endpoint, requestHash, responseSnapshot: payload },
      })
    } catch {
    }
  }
  return respondOk(req, payload, 200)
})
