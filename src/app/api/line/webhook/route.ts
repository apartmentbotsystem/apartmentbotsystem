import { verifyLineSignature } from "@/infrastructure/line/verifySignature"
import { LineHttpClient } from "@/infrastructure/line/LineHttpClient"
import { getRegistrationState, triggerRegistration } from "@/infrastructure/registration/registration.service"
import { messageForState } from "@/infrastructure/line/messageTemplates"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"

export const runtime = "nodejs"

type LineEvent =
  | { type: "follow"; replyToken: string; source: { type: "user"; userId: string } }
  | { type: "message"; replyToken: string; source: { type: "user"; userId: string }; message: { type: "text"; text: string } }

export async function POST(req: Request): Promise<Response> {
  const channelSecret = process.env.LINE_CHANNEL_SECRET
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const signature = req.headers.get("x-line-signature")
  const bodyText = await req.text()
  const ok = verifyLineSignature(signature, bodyText, channelSecret)
  if (!ok) return new Response("invalid signature", { status: 401 })
  const parsed = JSON.parse(bodyText) as { events?: LineEvent[] }
  if (!Array.isArray(parsed.events) || parsed.events.length === 0) return new Response("ok", { status: 200 })
  if (!token) return new Response("LINE not configured", { status: 500 })
  const client = new LineHttpClient(token)
  for (const ev of parsed.events) {
    if (ev.type === "follow" && ev.source?.type === "user" && ev.replyToken) {
      const state = await getRegistrationState(ev.source.userId)
      const msg = messageForState(state)
      try {
        await client.replyMessage({ replyToken: ev.replyToken, messages: [{ type: "text", text: msg }] })
      } catch {}
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
      try {
        await client.replyMessage({ replyToken: ev.replyToken, messages: [{ type: "text", text: msg }] })
      } catch {}
    }
  }
  return new Response("ok", { status: 200 })
}
