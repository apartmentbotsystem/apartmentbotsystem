import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { handleApiError } from '@/lib/http/error-handler'

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
    const rl = checkRateLimit(getClientIp(req), '/api/occupancy/move-in:POST')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })

    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER', 'ADMIN', 'STAFF'])

    const body = await req.json()
    const parse = schema.safeParse(body)
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid body' }, { status: 422 })

    const roomNumber = parse.data.roomNumber.trim()
    const primaryName = parse.data.primaryName.trim()
    const resident2Name = (parse.data.resident2Name ?? '').trim()
    const lineId = (parse.data.lineId ?? '').trim()
    const note = (parse.data.note ?? '').trim()
    const depositRaw = String(parse.data.deposit ?? '').trim()
    const startDate = new Date(parse.data.startDate)
    const deposit = depositRaw ? Number(depositRaw) : null

    if (Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid startDate' }, { status: 422 })
    }

    await prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { number: roomNumber } })
      if (!room || room.status !== 'VACANT') {
        throw new Error('ROOM_NOT_VACANT')
      }

      const primary = await tx.resident.create({ data: { fullName: primaryName } })
      const secondary = resident2Name ? await tx.resident.create({ data: { fullName: resident2Name } }) : null

      await tx.roomResident.create({
        data: {
          roomNumber,
          residentId: primary.id,
          role: 'PRIMARY',
          active: true,
          startDate
        }
      })

      if (secondary) {
        await tx.roomResident.create({
          data: {
            roomNumber,
            residentId: secondary.id,
            role: 'SECONDARY',
            active: true,
            startDate
          }
        })
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
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'ROOM_NOT_VACANT') {
      return NextResponse.json({ error: 'CONFLICT', message: 'Room is not vacant' }, { status: 409 })
    }
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
