import { NextResponse } from 'next/server'
import { createHmac } from 'node:crypto'
import { prisma } from '@/lib/db'
import { handleApiError } from '@/lib/http/error-handler'
import { ensureIdempotent } from '@/lib/http/idempotency'
import { setState, getState, clearState } from '@/services/lineConversation.service'
import { createRegistrationRequest } from '@/services/registration.service'
import { logger } from '@/lib/logging/file-logger'

export const runtime = 'nodejs'

async function replyText(replyToken: string, text: string) {
  const token = process.env['LINE_CHANNEL_TOKEN'] ?? ''
  if (!token) return
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }]
    })
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'reply failed'
    await logger.error('LINE_REPLY_FAILED', { error: msg })
    throw e
  }
}

function verifySignature(buf: Buffer, signature: string | null) {
  const secret = process.env['LINE_CHANNEL_SECRET'] ?? ''
  if (!secret || !signature) return false
  const digest = createHmac('sha256', secret).update(buf).digest('base64')
  return digest === signature
}

export async function POST(req: Request) {
  try {
    const { getServerConfig } = await import('@/lib/config/env')
    getServerConfig()
    const sig = req.headers.get('x-line-signature')
    const buf = Buffer.from(await req.arrayBuffer())
    if (!verifySignature(buf, sig)) {
      return NextResponse.json({ ok: true })
    }
    const body = JSON.parse(buf.toString('utf8')) as { events?: any[] }
    const events = Array.isArray(body.events) ? body.events : []
    for (const event of events) {
      const eventId: string = event?.webhookEventId ?? ''
      const replyToken: string | undefined = event?.replyToken
      const source = event?.source ?? {}
      const lineUserId: string | undefined = source?.userId
      if (!eventId || !lineUserId || !replyToken) {
        continue
      }
      const type = event?.type
      if (type !== 'message' || event?.message?.type !== 'text') {
        continue
      }
      const text: string = String(event?.message?.text ?? '').trim()
      const externalMessageId: string | undefined = event?.message?.id ? String(event.message.id) : undefined
      // Inbox Conversation capture (additive, non-intrusive)
      try {
        const lineUserIdStr: string | undefined = lineUserId
        if (lineUserIdStr) {
          const binding = await prisma.lineBinding.findUnique({ where: { lineUserId: lineUserIdStr } })
          const conv = await prisma.conversation.upsert({
            where: { lineUserId: lineUserIdStr },
            update: {
              lastMessageAt: new Date(),
              unreadAdmin: { increment: 1 },
              ...(binding?.roomNumber ? { roomNumber: binding.roomNumber } : {})
            },
            create: {
              lineUserId: lineUserIdStr,
              lastMessageAt: new Date(),
              unreadAdmin: 1,
              ...(binding?.roomNumber ? { roomNumber: binding.roomNumber } : {})
            }
          })
          await prisma.conversationMessage.create({
            data: {
              conversationId: conv.id,
              sender: 'RESIDENT',
              text
            }
          })
          try {
            await prisma.chat.create({
              data: {
                conversation_id: conv.id,
                sender: 'RESIDENT',
                text,
                ...(externalMessageId ? { external_message_id: externalMessageId } : {})
              }
            })
          } catch {
          }
        }
      } catch {
        // best-effort inbox capture, do not block webhook
      }
      const key = `line_webhook_${eventId}`
      const { reused } = await ensureIdempotent(key, key, key, async () => {
        if (text === 'ยกเลิก') {
          await clearState(lineUserId)
          await replyText(replyToken, 'ยกเลิกการลงทะเบียนเรียบร้อยแล้ว')
          return { ok: true }
        }
        if (text === 'ลงทะเบียน') {
          const st = await getState(lineUserId)
          if (st) {
            await replyText(replyToken, 'คุณกำลังลงทะเบียนอยู่\nหากต้องการยกเลิก กรุณาพิมพ์ "ยกเลิก"')
            return { ok: true }
          } else {
            await setState(lineUserId, 'WAITING_ROOM')
            await replyText(replyToken, 'กรุณากรอกเลขห้องของคุณ')
            return { ok: true }
          }
        }
        const st = await getState(lineUserId)
        if (!st) {
          // Ignore free text outside flow
          return { ok: true }
        }
        if (st.state === 'WAITING_ROOM') {
          const roomNumber = text
          const room = await prisma.room.findUnique({ where: { number: roomNumber } })
          if (!room) {
            await replyText(replyToken, 'ไม่พบเลขห้อง กรุณาตรวจสอบอีกครั้ง')
            return { ok: true }
          }
          await setState(lineUserId, 'WAITING_NAME', { tempRoom: roomNumber })
          await replyText(replyToken, 'กรุณากรอกชื่อ-นามสกุล')
          return { ok: true }
        }
        if (st.state === 'WAITING_NAME') {
          await setState(lineUserId, 'WAITING_PHONE', { tempName: text })
          await replyText(replyToken, 'กรุณากรอกเบอร์โทรศัพท์ (10 หลัก เช่น 0891234567)')
          return { ok: true }
        }
        if (st.state === 'WAITING_PHONE') {
          const phone = text
          const re = /^0\d{9}$/
          if (!re.test(phone)) {
            await replyText(replyToken, 'เบอร์โทรไม่ถูกต้อง กรุณากรอก 10 หลัก เช่น 0891234567')
            return { ok: true }
          }
          const latest = await getState(lineUserId)
          const roomNumber = latest?.tempRoom ?? ''
          const residentName = latest?.tempName ?? ''
          if (!roomNumber || !residentName) {
            await clearState(lineUserId)
            await replyText(replyToken, 'เกิดข้อผิดพลาด โปรดลองพิมพ์ "ลงทะเบียน" อีกครั้ง')
            return { ok: true }
          }
          await createRegistrationRequest({ lineUserId, roomNumber, residentName, phone })
          await clearState(lineUserId)
          await replyText(replyToken, 'คำขอลงทะเบียนถูกส่งให้ผู้ดูแลแล้ว')
          return { ok: true }
        }
        return { ok: true }
      })
      if (reused) {
        // duplicate event; do nothing
      }
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const http = handleApiError(err)
    // Always return 200 to LINE
    return NextResponse.json({ ok: true, error: http.body?.error ?? 'ok' })
  }
}
