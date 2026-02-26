import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import { checkRateLimitCustom, getClientIp } from '@/lib/http/rate-limit'
import { handleApiError } from '@/lib/http/error-handler'
import { addActiveResidentWithGuard } from '@/services/occupancy'
import { parseDateYmdToUtc } from '@/lib/time'
import { withTimeout } from '@/lib/http/guards'
import { verifyCsrf } from '@/lib/http/csrf'

const schema = z.object({
  roomNumber: z.string().min(1),
  primaryName: z.string().min(1),
  resident2Name: z.string().optional(),
  lineId: z.string().optional(),
  deposit: z.union([z.string(), z.number()]).optional(),
  startDate: z.string().min(1),
  note: z.string().optional()
})

export async function POST(req: Request) {
  try {
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER', 'ADMIN', 'STAFF'])
    if (!verifyCsrf(req)) return NextResponse.json({ error: 'CSRF', message: 'Invalid CSRF token' }, { status: 403 })
    const rl = checkRateLimitCustom(`${getClientIp(req)}:${user.id}:/api/occupancy/move-in:POST`, 5000, 10)
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })

    const body = await req.json()
    const parse = schema.safeParse(body)
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid body' }, { status: 422 })

    const roomNumber = parse.data.roomNumber.trim()
    const primaryName = parse.data.primaryName.trim()
    const resident2Name = (parse.data.resident2Name ?? '').trim()
    const lineId = (parse.data.lineId ?? '').trim()
    const note = (parse.data.note ?? '').trim()
    const depositRaw = String(parse.data.deposit ?? '').trim()
    const startDate = parseDateYmdToUtc(parse.data.startDate)
    const deposit = depositRaw ? Number(depositRaw) : null

    if (Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid startDate' }, { status: 422 })
    }
    // Room validity derives from database only

    await withTimeout(10_000, () => prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { number: roomNumber } })
      if (!room || room.status !== 'VACANT') {
        throw new Error('ROOM_NOT_VACANT')
      }

      const primary = await tx.resident.create({ data: { fullName: primaryName } })
      const secondary = resident2Name ? await tx.resident.create({ data: { fullName: resident2Name } }) : null

      await addActiveResidentWithGuard(tx, { roomNumber, residentId: primary.id, role: 'PRIMARY', startDate })

      if (secondary) {
        await addActiveResidentWithGuard(tx, { roomNumber, residentId: secondary.id, role: 'SECONDARY', startDate })
      }

      await tx.contract.create({
        data: {
          roomNumber,
          primaryResidentId: primary.id,
          startDate,
          active: true,
          residents: secondary ? { connect: [{ id: secondary.id }] } : undefined
        }
      })

      const detail = [
        note ? `note=${note}` : '',
        lineId ? `lineId=${lineId}` : '',
        deposit !== null && Number.isFinite(deposit) ? `deposit=${deposit.toFixed(2)}` : ''
      ].filter(Boolean).join(';')

      await tx.moveHistory.create({
        data: {
          roomNumber,
          residentId: primary.id,
          type: detail ? `MOVE_IN:${detail}` : 'MOVE_IN',
          at: new Date()
        }
      })

      await tx.room.update({ where: { number: roomNumber }, data: { status: 'OCCUPIED' } })

      if (lineId) {
        await tx.lineBinding.upsert({
          where: { lineUserId: lineId },
          update: { roomNumber },
          create: { lineUserId: lineId, roomNumber }
        })
        await tx.conversation.upsert({
          where: { lineUserId: lineId },
          update: { roomNumber, residentId: primary.id, lastMessageAt: new Date() },
          create: { lineUserId: lineId, roomNumber, residentId: primary.id, lastMessageAt: new Date() }
        })
      }
    }))

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'ROOM_NOT_VACANT') {
      return NextResponse.json({ error: 'CONFLICT', message: 'Room is not vacant' }, { status: 409 })
    }
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
