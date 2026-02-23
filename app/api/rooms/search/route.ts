import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { compareRoomNumbersNatural } from '@/lib/room-sort'

export async function GET(req: Request) {
  const rl = checkRateLimit(getClientIp(req), '/api/rooms/search:GET')
  if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })

  const user = await requireSession(req)
  enforceRoleBoundary(user, ['OWNER', 'ADMIN', 'STAFF'])

  const url = new URL(req.url)
  const q = String(url.searchParams.get('q') ?? '').trim()
  if (!q) return NextResponse.json({ items: [] })

  const rooms = await prisma.room.findMany({
    where: { number: { contains: q } },
    select: { number: true, status: true, floor: { select: { idx: true } } },
    take: 30
  })
  rooms.sort((a, b) => compareRoomNumbersNatural(a.number, b.number))
  return NextResponse.json({ items: rooms })
}

