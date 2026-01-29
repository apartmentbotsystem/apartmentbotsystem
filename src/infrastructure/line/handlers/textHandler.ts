import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { LineHttpClient } from "@/infrastructure/line/LineHttpClient"
import { buildInvoiceBubble } from "@/infrastructure/line/flex/invoiceBubble"
import type { RequestMeta } from "@/interface/http/request-context"
import { logger } from "@/interface/logger/logger"

function normalizeText(s: string): string {
  return (s || "").trim().toLowerCase()
}

async function findTenantIdByLineUser(lineUserId: string): Promise<string | null> {
  const t = await prisma.tenant.findFirst({ where: { lineUserId } })
  return t?.id ?? null
}

async function findInvoiceForCommand(tenantId: string, cmd: "บิล" | "ค้างชำระ" | "ยอดเดือนนี้") {
  if (cmd === "ค้างชำระ") {
    const inv = await prisma.invoice.findFirst({
      where: { tenantId, status: "SENT" },
      orderBy: [{ dueDate: "desc" }],
    })
    return inv
  }
  if (cmd === "ยอดเดือนนี้") {
    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const inv = await prisma.invoice.findFirst({
      where: { tenantId, periodMonth: ym },
      orderBy: [{ dueDate: "desc" }],
    })
    return inv
  }
  const inv = await prisma.invoice.findFirst({
    where: { tenantId },
    orderBy: [{ dueDate: "desc" }],
  })
  return inv
}

export async function handleText(ev: { replyToken: string; userId: string; text: string }, client: LineHttpClient, meta?: RequestMeta): Promise<void> {
  const tenantId = await findTenantIdByLineUser(ev.userId)
  if (!tenantId) {
    await client.replyMessage({ replyToken: ev.replyToken, messages: [{ type: "text", text: "ไม่พบข้อมูลผู้เช่า กรุณาติดต่อแอดมิน" }] })
    if (meta) logger.warn({ requestId: meta.requestId, method: meta.method, path: meta.path, status: 200 })
    return
  }
  const t = normalizeText(ev.text)
  const isInquiry = t === "บิล" || t === "ค้างชำระ" || t === "ยอดเดือนนี้"
  if (!isInquiry) {
    await client.replyMessage({ replyToken: ev.replyToken, messages: [{ type: "text", text: "พิมพ์: บิล / ค้างชำระ / ยอดเดือนนี้" }] })
    return
  }
  const inv = await findInvoiceForCommand(tenantId, t as "บิล" | "ค้างชำระ" | "ยอดเดือนนี้")
  if (!inv) {
    await client.replyMessage({ replyToken: ev.replyToken, messages: [{ type: "text", text: "ไม่พบข้อมูลบิล" }] })
    return
  }
  const bubble = buildInvoiceBubble({
    periodMonth: inv.periodMonth,
    totalAmount: inv.totalAmount,
    status: inv.status,
    invoiceId: inv.id,
  })
  await client.replyMessage({ replyToken: ev.replyToken, messages: [bubble] as Array<Record<string, unknown>> })
  if (meta) logger.info({ requestId: meta.requestId, method: meta.method, path: meta.path, status: 200 })
}
