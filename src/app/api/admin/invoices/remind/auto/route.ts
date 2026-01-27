import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { LineHttpClient } from "@/infrastructure/line/LineHttpClient"
import { isInvoiceOverdue } from "@/domain/invoice/isInvoiceOverdue"

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

function mapBucket(daysLate: number): "SOFT" | "WARN" | "HARD" | null {
  if (daysLate >= 3 && daysLate <= 7) return "SOFT"
  if (daysLate >= 8 && daysLate <= 30) return "WARN"
  if (daysLate > 30) return "HARD"
  return null
}

function actionForBucket(bucket: "SOFT" | "WARN" | "HARD"): string {
  if (bucket === "SOFT") return "INVOICE_REMINDER_SOFT_SENT"
  if (bucket === "WARN") return "INVOICE_REMINDER_WARN_SENT"
  return "INVOICE_REMINDER_HARD_SENT"
}

export const runtime = "nodejs"

export const POST = withErrorHandling(async (req: Request): Promise<Response> => {
  const session = await requireRole(req, ["ADMIN"])
  const now = new Date()
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
  const rows = await prisma.invoice.findMany({
    where: { status: "SENT", periodMonth: { lte: currentMonth } },
    include: { tenant: { select: { id: true, lineUserId: true } }, room: { select: { id: true, roomNumber: true } } },
    orderBy: [{ periodMonth: "asc" }, { issuedAt: "asc" }],
    take: 5000,
  })
  type Row = Awaited<ReturnType<typeof prisma.invoice.findMany>>[number]
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return new Response(JSON.stringify({ code: "VALIDATION_ERROR", message: "LINE access token not configured" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }
  const client = new LineHttpClient(token)
  let softSent = 0
  let warnSent = 0
  let hardSent = 0
  let skipped = 0
  for (const inv of rows as Row[]) {
    const overdue = isInvoiceOverdue(
      { status: inv.status as "DRAFT" | "SENT" | "PAID" | "CANCELLED", paidAt: inv.paidAt ?? null, periodMonth: inv.periodMonth },
      now,
    )
    if (!overdue) {
      skipped++
      continue
    }
    const due = calculateDueDate(inv.periodMonth)
    const daysLate = Math.max(0, Math.floor((now.getTime() - due.getTime()) / (24 * 60 * 60 * 1000)))
    const bucket = mapBucket(daysLate)
    if (!bucket) {
      skipped++
      continue
    }
    const to = inv.tenant?.lineUserId || null
    if (!to) {
      skipped++
      continue
    }
    const action = actionForBucket(bucket)
    const already = await prisma.auditEvent.findFirst({
      where: { action, metadata: { path: ["invoiceId"], equals: inv.id } },
      orderBy: { timestamp: "desc" },
      take: 1,
    })
    if (already) {
      skipped++
      continue
    }
    const amt = Number(inv.totalAmount || 0)
    const amtText = amt.toLocaleString("th-TH")
    const roomNumber = inv.room?.roomNumber || ""
    const messages: Record<"SOFT" | "WARN" | "HARD", string> = {
      SOFT:
        `📄 แจ้งเตือนการชำระเงิน\n` +
        `ใบแจ้งหนี้เดือน ${inv.periodMonth}\n` +
        `ห้อง ${roomNumber}\n` +
        `ยอดค้าง ${amtText} บาท\n` +
        `หากชำระแล้วขออภัยในความไม่สะดวกครับ`,
      WARN:
        `⚠️ แจ้งเตือนค้างชำระ\n` +
        `ใบแจ้งหนี้เดือน ${inv.periodMonth}\n` +
        `ห้อง ${roomNumber}\n` +
        `ยอด ${amtText} บาท\n` +
        `ค้างชำระ ${daysLate} วัน`,
      HARD:
        `🚨 แจ้งเตือนค้างชำระเกินกำหนด\n` +
        `ใบแจ้งหนี้เดือน ${inv.periodMonth}\n` +
        `ห้อง ${roomNumber}\n` +
        `ยอด ${amtText} บาท\n` +
        `กรุณาติดต่อสำนักงาน`,
    }
    await prisma.$transaction(async (tx) => {
      await client.pushMessage({ to, messages: [{ type: "text", text: messages[bucket] }] })
      await tx.auditEvent.create({
        data: {
          actorType: "ADMIN",
          actorId: session.userId,
          action,
          targetType: "INVOICE",
          targetId: inv.id,
          severity: "INFO",
          metadata: { invoiceId: inv.id, periodMonth: inv.periodMonth, bucket, daysLate },
        },
      })
    })
    if (bucket === "SOFT") softSent++
    else if (bucket === "WARN") warnSent++
    else hardSent++
  }
  const data = {
    totalChecked: rows.length,
    sent: { soft: softSent, warn: warnSent, hard: hardSent },
    skipped,
  }
  return respondOk(req, data, 200)
})

