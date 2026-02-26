import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as Placeholders from '@/services/placeholders'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import type { AuthUser } from '@/lib/auth/types'
import { clampLimitFromRequest, withTimeout } from '@/lib/http/guards'
import { runWithRequestContext } from '@/infrastructure/request-context'

export const runtime = 'nodejs'

const qp = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int(),
  roomNumber: z.string().optional()
})

export async function GET(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/billing/placeholders:GET')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER', 'ADMIN', 'STAFF'])
    const url = new URL(req.url)
    const parse = qp.safeParse({
      year: url.searchParams.get('year'),
      month: url.searchParams.get('month'),
      roomNumber: url.searchParams.get('roomNumber') ?? undefined
    })
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid query' }, { status: 422 })
    const { year, month, roomNumber } = parse.data
    const limit = clampLimitFromRequest(req, 50, 200)
    const items = await withTimeout(10_000, () =>
      runWithRequestContext({ route: '/api/billing/placeholders:GET', userId: user.id }, () =>
        Placeholders.listPlaceholders(user, year, month, roomNumber)
      )
    )
    return NextResponse.json({ items: items.slice(0, limit) })
  } catch (err) {
    const http = handleApiError(err)
    const status = http.status === 500 && http.body.error === 'INTERNAL' && http.body.message === 'REQUEST_TIMEOUT' ? 504 : http.status
    return NextResponse.json(http.body, { status })
  }
}
