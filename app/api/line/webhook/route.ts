import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/db'
import { handleApiError } from '@/lib/http/error-handler'
import { ensureIdempotent } from '@/lib/http/idempotency'
import { setState, getState, clearState } from '@/services/lineConversation.service'
import { createRegistrationRequest } from '@/services/registration.service'
import { logError } from '@/infrastructure/logger'
import { Prisma } from '@prisma/client'
import { getLineAccessTokenPreferDb, getLineSecretPreferDb } from '@/lib/config/env'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { withTimeout } from '@/lib/http/guards'
import { fetchMediaContent, headMediaSize } from '@/infrastructure/line/lineMediaService'
import { uploadBuffer } from '@/infrastructure/storage/supabase'

export const runtime = 'nodejs'
const MAX_MEDIA_SIZE = 10 * 1024 * 1024

type WebhookEvent = {
  webhookEventId?: string
  replyToken?: string
  type?: string
  source?: { userId?: string }
  message?: { type?: string; text?: string; id?: string | number; fileName?: string; contentProvider?: unknown }
}

type WebhookBody = {
  events?: WebhookEvent[]
}

function isWebhookBody(v: unknown): v is WebhookBody {
  return !!v && typeof v === 'object' && Array.isArray((v as { events?: unknown }).events)
}

function isPrismaUniqueError(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
}

async function replyText(replyToken: string, text: string) {
  let token = ''
  try {
    token = await withTimeout(10_000, () => getLineAccessTokenPreferDb())
  } catch {
    return
  }
  try {
    await withTimeout(10_000, () => fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }]
    })
    }))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'reply failed'
    logError('LINE_REPLY_FAILED', { error: msg })
    throw e
  }
}

async function verifySignature(buf: Buffer, signature: string | null) {
  let secret = ''
  try {
    secret = await withTimeout(10_000, () => getLineSecretPreferDb())
  } catch {
    secret = ''
  }
  if (!secret || !signature) return false
  try {
    const mac = createHmac('sha256', secret).update(buf).digest()
    const sigBuf = Buffer.from(signature, 'base64')
    if (mac.length !== sigBuf.length) return false
    return timingSafeEqual(mac, sigBuf)
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/line/webhook:POST')
    if (!rl.allowed) {
      return NextResponse.json({ ok: true })
    }
    await withTimeout(10_000, async () => {
      const sig = req.headers.get('x-line-signature')
      const buf = Buffer.from(await req.arrayBuffer())
      if (!(await verifySignature(buf, sig))) {
        try { logError('LINE_SIGNATURE_INVALID', {}) } catch (error) {
          console.error('WEBHOOK_LOG_FAILED', {
            error: error instanceof Error ? error.message : String(error)
          })
        }
        return
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(buf.toString('utf8'))
      } catch {
        return
      }
      if (!isWebhookBody(parsed)) {
        return
      }
      const events = parsed.events ?? []
      for (const event of events) {
        const eventId: string = event?.webhookEventId ?? ''
        const replyToken: string | undefined = event?.replyToken
        const source = event?.source ?? {}
        const lineUserId: string | undefined = source?.userId
        if (!eventId || !lineUserId || !replyToken) {
          continue
        }
        const idemKey = `line_webhook_${eventId}`
        const idem = await withTimeout(10_000, () => ensureIdempotent(idemKey, idemKey, idemKey, async () => ({ ok: true as const })))
        if (idem.reused) {
          continue
        }
        const type = event?.type
        if (type !== 'message') {
          continue
        }
        const msgType = String(event?.message?.type ?? '')
        const text: string = String(event?.message?.text ?? '').trim()
        const externalMessageId: string | undefined = event?.message?.id ? String(event.message.id) : undefined
        let conversationId: string | undefined
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
            conversationId = conv.id
            if (msgType === 'text') {
              try {
                await prisma.conversationMessage.create({
                  data: {
                    conversationId: conv.id,
                    sender: 'RESIDENT',
                    text,
                    ...(externalMessageId ? { externalMessageId } : {})
                  }
                })
              } catch (e) {
                if (isPrismaUniqueError(e)) {
                  // Unique constraint; ignore duplicate
                } else {
                  try { logError('CM_CREATE_FAILED', { error: e instanceof Error ? e.message : 'unknown' }) } catch (error) {
                    console.error('WEBHOOK_LOG_FAILED', {
                      eventId,
                      conversationId,
                      messageId: externalMessageId,
                      error: error instanceof Error ? error.message : String(error)
                    })
                  }
                }
              }
              try {
                await prisma.chat.create({
                  data: {
                    conversation_id: conv.id,
                    sender: 'RESIDENT',
                    text,
                    ...(externalMessageId ? { external_message_id: externalMessageId } : {})
                  }
                })
              } catch (error) {
                console.error('WEBHOOK_CHAT_MIRROR_FAILED', {
                  eventId,
                  conversationId,
                  messageId: externalMessageId,
                  error: error instanceof Error ? error.message : String(error)
                })
              }
            } else if (['image', 'file', 'video', 'audio'].includes(msgType)) {
              let mediaPath: string | null = null
              let mediaType: string | null = null
              let fileName: string | null = null
              let fileSize: number | null = null
              try {
                const mid = externalMessageId ?? ''
                // Task 2 — Media size limit
                const sizeHead = await headMediaSize(mid)
                if (sizeHead && sizeHead > MAX_MEDIA_SIZE) {
                  try {
                    await replyText(replyToken, 'ขนาดไฟล์เกิน 10MB ไม่สามารถอัปโหลดได้ กรุณาส่งไฟล์ที่เล็กกว่า')
                  } catch (error) {
                    console.error('WEBHOOK_REPLY_FAILED', {
                      eventId,
                      conversationId,
                      messageId: externalMessageId,
                      error: error instanceof Error ? error.message : String(error)
                    })
                  }
                  continue
                }
                const fetched = await fetchMediaContent(mid)
                mediaType = fetched.contentType
                const ext = (() => {
                  const ct = fetched.contentType
                  if (ct.includes('image/')) return '.jpg'
                  if (ct.includes('video/')) return '.mp4'
                  if (ct.includes('audio/')) return '.m4a'
                  return ''
                })()
                fileName = (event?.message as { fileName?: string } | undefined)?.fileName || `${mid}${ext}`
                fileSize = fetched.buffer.byteLength
                const path = `${conv.id}/${mid}/${fileName}`
                const up = await uploadBuffer('line-uploads', path, fetched.buffer, fetched.contentType)
                mediaPath = up.path
              } catch (e) {
                try { logError('LINE_MEDIA_STORE_FAILED', { error: e instanceof Error ? e.message : 'unknown' }) } catch (error) {
                  console.error('WEBHOOK_LOG_FAILED', {
                    eventId,
                    conversationId,
                    messageId: externalMessageId,
                    error: error instanceof Error ? error.message : String(error)
                  })
                }
              } finally {
                try {
                  await prisma.conversationMessage.create({
                    data: {
                      conversationId: conv.id,
                      sender: 'RESIDENT',
                      text: text || `[${msgType}]`,
                      ...(externalMessageId ? { externalMessageId } : {}),
                      mediaType: msgType,
                      mediaPath: mediaPath ?? undefined,
                      fileName: fileName ?? undefined,
                      fileSize: fileSize ?? undefined
                    }
                  })
                } catch (e) {
                  if (isPrismaUniqueError(e)) {
                    // Duplicate by unique constraint; ignore
                  } else {
                    try { logError('CM_CREATE_FAILED', { error: e instanceof Error ? e.message : 'unknown' }) } catch (error) {
                      console.error('WEBHOOK_LOG_FAILED', {
                        eventId,
                        conversationId,
                        messageId: externalMessageId,
                        error: error instanceof Error ? error.message : String(error)
                      })
                    }
                  }
                }
                if (externalMessageId) {
                  try {
                    await prisma.chat.create({
                      data: {
                        conversation_id: conv.id,
                        sender: 'RESIDENT',
                        text: text || `[${msgType}]`,
                        ...(externalMessageId ? { external_message_id: externalMessageId } : {})
                      }
                    })
                  } catch (error) {
                    console.error('WEBHOOK_CHAT_MIRROR_FAILED', {
                      eventId,
                      conversationId,
                      messageId: externalMessageId,
                      error: error instanceof Error ? error.message : String(error)
                    })
                  }
                }
              }
            } else {
              // Unknown message type: record as placeholder
              try {
                await prisma.conversationMessage.create({
                  data: {
                    conversationId: conv.id,
                    sender: 'RESIDENT',
                    text: '[unsupported message]',
                    ...(externalMessageId ? { externalMessageId } : {})
                  }
                })
              } catch (e) {
                if (isPrismaUniqueError(e)) {
                } else {
                  try { logError('CM_CREATE_FAILED', { error: e instanceof Error ? e.message : 'unknown' }) } catch (error) {
                    console.error('WEBHOOK_LOG_FAILED', {
                      eventId,
                      conversationId,
                      messageId: externalMessageId,
                      error: error instanceof Error ? error.message : String(error)
                    })
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('WEBHOOK_EVENT_FAILED', {
            eventId,
            conversationId,
            messageId: externalMessageId,
            error: error instanceof Error ? error.message : String(error)
          })
        }
        // Registration state machine and replies
        if (msgType === 'text' && text === 'ยกเลิก') {
          await clearState(lineUserId)
          await replyText(replyToken, 'ยกเลิกการลงทะเบียนเรียบร้อยแล้ว')
          continue
        }
        if (msgType === 'text' && text === 'ลงทะเบียน') {
          const st = await getState(lineUserId)
          if (st) {
            await replyText(replyToken, 'คุณกำลังลงทะเบียนอยู่\nหากต้องการยกเลิก กรุณาพิมพ์ "ยกเลิก"')
            continue
          } else {
            await setState(lineUserId, 'WAITING_ROOM')
            await replyText(replyToken, 'กรุณากรอกเลขห้องของคุณ')
            continue
          }
        }
        const st = await getState(lineUserId)
        if (!st) {
          continue
        }
        if (msgType === 'text' && st.state === 'WAITING_ROOM') {
          const roomNumber = text
          const room = await prisma.room.findUnique({ where: { number: roomNumber } })
          if (!room) {
            await replyText(replyToken, 'ไม่พบเลขห้อง กรุณาตรวจสอบอีกครั้ง')
            continue
          }
          await setState(lineUserId, 'WAITING_NAME', { tempRoom: roomNumber })
          await replyText(replyToken, 'กรุณากรอกชื่อ-นามสกุล')
          continue
        }
        if (msgType === 'text' && st.state === 'WAITING_NAME') {
          await setState(lineUserId, 'WAITING_PHONE', { tempName: text })
          await replyText(replyToken, 'กรุณากรอกเบอร์โทรศัพท์ (10 หลัก เช่น 0891234567)')
          continue
        }
        if (msgType === 'text' && st.state === 'WAITING_PHONE') {
          const phone = text
          const re = /^0\d{9}$/
          if (!re.test(phone)) {
            await replyText(replyToken, 'เบอร์โทรไม่ถูกต้อง กรุณากรอก 10 หลัก เช่น 0891234567')
            continue
          }
          const latest = await getState(lineUserId)
          const roomNumber = latest?.tempRoom ?? ''
          const residentName = latest?.tempName ?? ''
          if (!roomNumber || !residentName) {
            await clearState(lineUserId)
            await replyText(replyToken, 'เกิดข้อผิดพลาด โปรดลองพิมพ์ \"ลงทะเบียน\" อีกครั้ง')
            continue
          }
          await createRegistrationRequest({ lineUserId, roomNumber, residentName, phone })
          await clearState(lineUserId)
          await replyText(replyToken, 'คำขอลงทะเบียนถูกส่งให้ผู้ดูแลแล้ว')
          continue
        }
      }
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const http = handleApiError(err)
    // Always return 200 to LINE
    return NextResponse.json({ ok: true, error: http.body?.error ?? 'ok' })
  }
}
