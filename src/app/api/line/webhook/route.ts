import { verifyLineSignature } from "@/infrastructure/line/verifySignature"
import { LineHttpClient } from "@/infrastructure/line/LineHttpClient"
import { getRegistrationState, triggerRegistration } from "@/infrastructure/registration/registration.service"
import { messageForState } from "@/infrastructure/line/messageTemplates"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { handleFollow } from "@/infrastructure/line/handlers/followHandler"
import { handleText } from "@/infrastructure/line/handlers/textHandler"
import { handlePostback } from "@/infrastructure/line/handlers/postbackHandler"
import { buildRequestMeta } from "@/interface/http/request-context"
import { logger } from "@/interface/logger/logger"

export const runtime = "nodejs"

type LineEvent =
  | { type: "follow"; replyToken: string; source: { type: "user"; userId: string } }
  | { type: "message"; replyToken: string; source: { type: "user"; userId: string }; message: { type: "text"; text: string } }
  | { type: "postback"; replyToken: string; source: { type: "user"; userId: string }; postback: { data: string } }

export async function POST(req: Request): Promise<Response> {
  const channelSecret = process.env.LINE_CHANNEL_SECRET
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const signature = req.headers.get("x-line-signature")
  const meta = buildRequestMeta(req)
  if (!channelSecret || !token) {
    logger.error({ requestId: meta.requestId, method: meta.method, path: meta.path, status: 500, message: "LINE env missing" })
    return new Response("LINE not configured", { status: 500 })
  }
  const bodyText = await req.text()
  const ok = verifyLineSignature(signature, bodyText, channelSecret)
  if (!ok) {
    logger.warn({ requestId: meta.requestId, method: meta.method, path: meta.path, status: 401 })
    return new Response("invalid signature", { status: 401 })
  }
  const parsed = JSON.parse(bodyText) as { events?: LineEvent[] }
  if (!Array.isArray(parsed.events) || parsed.events.length === 0) {
    logger.info({ requestId: meta.requestId, method: meta.method, path: meta.path, status: 200 })
    return new Response("ok", { status: 200 })
  }
  const client = new LineHttpClient(token)
  logger.info({ requestId: meta.requestId, method: meta.method, path: meta.path, status: 200 })
  for (const ev of parsed.events) {
    try {
      if (ev.type === "follow" && ev.source?.type === "user" && ev.replyToken) {
        await handleFollow({ replyToken: ev.replyToken, userId: ev.source.userId }, client, meta)
      } else if (ev.type === "message" && ev.source?.type === "user" && ev.replyToken && ev.message?.type === "text") {
        const text = (ev.message.text || "").trim().toLowerCase()
        const isRegister = text === "สมัคร" || text === "ลงทะเบียน" || text === "register"
        let state = await getRegistrationState(ev.source.userId)
        if (isRegister) {
          const existing = await prisma.tenantRegistration.findUnique({ where: { lineUserId: ev.source.userId } })
          if (existing) {
            if (existing.status === "REJECTED") {
              state = await triggerRegistration(ev.source.userId)
            } else {
              state = existing.status === "ACTIVE" ? "ACTIVE" : existing.status === "PENDING" ? "PENDING" : "REJECTED"
            }
          } else if (state === "NONE" || state === "REJECTED") {
            state = await triggerRegistration(ev.source.userId)
          }
        }
        const msg = messageForState(state)
        if (isRegister) {
          await client.replyMessage({ replyToken: ev.replyToken, messages: [{ type: "text", text: msg }] })
        } else {
          await handleText({ replyToken: ev.replyToken, userId: ev.source.userId, text }, client, meta)
        }
      } else if (ev.type === "postback" && ev.source?.type === "user" && ev.replyToken && ev.postback?.data) {
        await handlePostback({ replyToken: ev.replyToken, userId: ev.source.userId, data: ev.postback.data }, client, meta)
      } else {
        logger.warn({ requestId: meta.requestId, method: meta.method, path: meta.path, status: 200 })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      logger.error({ requestId: meta.requestId, method: meta.method, path: meta.path, status: 500, message: msg })
    }
  }
  return new Response("ok", { status: 200 })
}
