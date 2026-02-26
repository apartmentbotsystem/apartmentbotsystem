import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as Tickets from '@/services/tickets'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp, checkRateLimitCustom } from '@/lib/http/rate-limit'
import type { AuthUser } from '@/lib/auth/types'
import { clampLimitFromRequest, withTimeout } from '@/lib/http/guards'
import { runWithRequestContext } from '@/infrastructure/request-context'
import { verifyCsrf } from '@/lib/http/csrf'

export async function GET(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/tickets:GET')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['ADMIN', 'STAFF', 'OWNER'])
    const limit = clampLimitFromRequest(req, 50, 200)
    const items = await withTimeout(10_000, () =>
      runWithRequestContext({ route: '/api/tickets:GET', userId: user.id }, () =>
        Tickets.listTickets(user)
      )
    )
    return NextResponse.json({ items: items.slice(0, limit) })
  } catch (err) {
    const http = handleApiError(err)
    const status = http.status === 500 && http.body.error === 'INTERNAL' && http.body.message === 'REQUEST_TIMEOUT' ? 504 : http.status
    return NextResponse.json(http.body, { status })
  }
}

const schema = z.object({
  roomNumber: z.string(),
  residentId: z.string().optional(),
  text: z.string().min(1)
})

export async function POST(req: Request) {
  try {
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['ADMIN', 'STAFF', 'OWNER'])
    if (!verifyCsrf(req)) return NextResponse.json({ error: 'CSRF', message: 'Invalid CSRF token' }, { status: 403 })
    const rl = checkRateLimitCustom(`${getClientIp(req)}:${user.id}:/api/tickets:POST`, 5000, 10)
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const body = await req.json()
    const parse = schema.safeParse(body)
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid body' }, { status: 422 })
    const { roomNumber, residentId, text } = parse.data
    const payload: { roomNumber: string; residentId?: string; text: string } = { roomNumber, text }
    if (typeof residentId === 'string') payload.residentId = residentId
    const t = await withTimeout(10_000, () =>
      runWithRequestContext({ route: '/api/tickets:POST', userId: user.id }, () =>
        Tickets.createTicket(user, payload, user.id)
      )
    )
    return NextResponse.json(t)
  } catch (err) {
    const http = handleApiError(err)
    const status = http.status === 500 && http.body.error === 'INTERNAL' && http.body.message === 'REQUEST_TIMEOUT' ? 504 : http.status
    return NextResponse.json(http.body, { status })
  }
}
