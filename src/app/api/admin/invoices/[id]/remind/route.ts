import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { LineHttpClient } from "@/infrastructure/line/LineHttpClient"
import { isInvoiceOverdue } from "@/domain/invoice/isInvoiceOverdue"
import { emitAuditEvent } from "@/infrastructure/audit/audit.service"

export const runtime = "nodejs"

function parseGraceDays(): number {
  const v = Number(process.env.INVOICE_GRACE_DAYS)
  if (!Number.isFinite(v) || v <= 0) return 5
  return Math.floor(v)
}

function calculateDueDate(periodMonth: string): Date {
  const [y, m] = String(periodMonth).split("-").map((s) => Number(s))
  const end = new Date(Date.UTC(y, m, 0))
  const grace = parseGraceDays()
  return new Date(end.getTime() + grace * 24 * 60 * 60 * 1000)
}

export const POST = withErrorHandling(async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const session = await requireRole(req, ["ADMIN"])
  const { id } = await ctx.params
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
  const overdue = isInvoiceOverdue({
    status: invoice.status as "DRAFT" | "SENT" | "PAID" | "CANCELLED",
    paidAt: invoice.paidAt ?? null,
    periodMonth: invoice.periodMonth,
  })
  if (!overdue) {
    return new Response(JSON.stringify({ code: "NOT_OVERDUE", message: "Invoice is not overdue" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }
  const last = await prisma.auditEvent.findFirst({
    where: {
      action: "INVOICE_REMINDER_SENT",
      metadata: { path: ["invoiceId"], equals: invoice.id },
    },
    orderBy: { timestamp: "desc" },
  })
  if (last) {
    const now = new Date()
    const diffMs = now.getTime() - last.timestamp.getTime()
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000
    if (diffMs < TWENTY_FOUR_HOURS) {
      const retryAfterHours = Math.max(1, Math.ceil((TWENTY_FOUR_HOURS - diffMs) / (60 * 60 * 1000)))
      return new Response(JSON.stringify({ code: "REMINDER_COOLDOWN_ACTIVE", retryAfterHours }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }
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
  const roomNumber = invoice.room?.roomNumber || ""
  const amt = Number(invoice.totalAmount || 0)
  const amtText = amt.toLocaleString("th-TH")
  const text =
    `⏰ แจ้งเตือนค้างชำระค่าเช่า\n\n` +
    `ห้อง ${roomNumber}\n` +
    `งวด ${invoice.periodMonth}\n` +
    `ยอดค้างชำระ ${amtText} บาท\n\n` +
    `กรุณาชำระโดยเร็ว\n` +
    `หากชำระแล้วสามารถแจ้งแอดมินได้ทันที 🙏`
  await client.pushMessage({ to, messages: [{ type: "text", text }] })
  const due = calculateDueDate(invoice.periodMonth)
  const now = new Date()
  const overdueDays = Math.max(0, Math.floor((now.getTime() - due.getTime()) / (24 * 60 * 60 * 1000)))
  await emitAuditEvent({
    actorType: "ADMIN",
    actorId: session.userId,
    action: "INVOICE_REMINDER_SENT",
    targetType: "INVOICE",
    targetId: invoice.id,
    severity: "INFO",
    metadata: { invoiceId: invoice.id, periodMonth: invoice.periodMonth, overdueDays },
  })
  return respondOk(req, { id: invoice.id }, 200)
})
