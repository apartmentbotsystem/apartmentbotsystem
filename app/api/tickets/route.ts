import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as Tickets from '@/services/tickets'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import type { AuthUser } from '@/lib/auth/types'

export async function GET(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/tickets:GET')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['ADMIN', 'STAFF', 'OWNER'])
    const items = await Tickets.listTickets(user)
    return NextResponse.json({ items })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}

const schema = z.object({
  roomNumber: z.string(),
  residentId: z.string().optional(),
  text: z.string().min(1)
})

export async function POST(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/tickets:POST')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['ADMIN', 'STAFF', 'OWNER'])
    const body = await req.json()
    const parse = schema.safeParse(body)
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid body' }, { status: 422 })
    const { roomNumber, residentId, text } = parse.data
    const payload: { roomNumber: string; residentId?: string; text: string } = { roomNumber, text }
    if (typeof residentId === 'string') payload.residentId = residentId
    const t = await Tickets.createTicket(user, payload, user.id)
    return NextResponse.json(t)
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
