import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { LineHttpClient } from "@/infrastructure/line/LineHttpClient"
import type { RequestMeta } from "@/interface/http/request-context"
import { logger } from "@/interface/logger/logger"

function parseData(data: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (data || "").split("&")) {
    const [k, v] = part.split("=")
    if (k) out[k] = decodeURIComponent(v || "")
  }
  return out
}

async function findTenantIdByLineUser(lineUserId: string): Promise<string | null> {
  const t = await prisma.tenant.findFirst({ where: { lineUserId } })
  return t?.id ?? null
}

export async function handlePostback(ev: { replyToken: string; userId: string; data: string }, client: LineHttpClient, meta?: RequestMeta): Promise<void> {
  const params = parseData(ev.data)
  const action = params["action"]
  const invoiceId = params["invoiceId"]
  const tenantId = await findTenantIdByLineUser(ev.userId)
  if (!tenantId) {
    await client.replyMessage({ replyToken: ev.replyToken, messages: [{ type: "text", text: "ไม่พบข้อมูลผู้เช่า กรุณาติดต่อแอดมิน" }] })
    if (meta) logger.warn({ requestId: meta.requestId, method: meta.method, path: meta.path, status: 200 })
    return
  }
  if (action === "report_paid" && invoiceId) {
    const now = new Date()
    await prisma.auditEvent.create({
      data: {
        actorType: "TENANT",
        actorId: tenantId,
        action: "PAYMENT_REPORTED",
        targetType: "INVOICE",
        targetId: invoiceId,
        severity: "INFO",
        metadata: { lineUserId: ev.userId, invoiceId, reportedAt: now.toISOString() },
      },
    })
    if (meta) logger.info({ requestId: meta.requestId, method: meta.method, path: meta.path, status: 200 })
    const adminTo = process.env.LINE_ADMIN_USER_ID
    if (adminTo) {
      try {
        await client.pushMessage({
          to: adminTo,
          messages: [{ type: "text", text: `มีการแจ้งโอน: tenant=${tenantId} invoice=${invoiceId}` }],
        })
      } catch {}
    }
    await client.replyMessage({ replyToken: ev.replyToken, messages: [{ type: "text", text: "รับแจ้งแล้ว ทีมงานจะตรวจสอบและยืนยันทาง LINE อีกครั้ง" }] })
    return
  }
  if (action === "pay_info" && invoiceId) {
    await client.replyMessage({
      replyToken: ev.replyToken,
      messages: [
        {
          type: "text",
          text: "โปรดโอนตามยอดบิลและระบุหมายเหตุเลขบิล จากนั้นกด “แจ้งโอนแล้ว”",
        },
      ],
    })
    return
  }
  await client.replyMessage({ replyToken: ev.replyToken, messages: [{ type: "text", text: "คำสั่งไม่ถูกต้อง" }] })
}
