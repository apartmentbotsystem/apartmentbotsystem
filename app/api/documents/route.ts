import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as Documents from '@/services/documents'
import type { AuthUser } from '@/lib/auth/types'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { clampLimitFromRequest, withTimeout } from '@/lib/http/guards'
import { runWithRequestContext } from '@/infrastructure/request-context'

const qp = z.object({
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().optional(),
  roomNumber: z.string().optional()
})

export async function GET(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/documents:GET')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['ADMIN', 'STAFF', 'OWNER'])
    const url = new URL(req.url)
    const parse = qp.safeParse({
      year: url.searchParams.get('year') ?? undefined,
      month: url.searchParams.get('month') ?? undefined,
      roomNumber: url.searchParams.get('roomNumber') ?? undefined
    })
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid query' }, { status: 422 })
    const { year, month, roomNumber } = parse.data
    const opts: { year?: number; month?: number; roomNumber?: string } = {}
    if (typeof year === 'number') opts.year = year
    if (typeof month === 'number') opts.month = month
    if (roomNumber) opts.roomNumber = roomNumber
    const limit = clampLimitFromRequest(req, 50, 200)
    const items = await withTimeout(10_000, () =>
      runWithRequestContext({ route: '/api/documents:GET', userId: user.id }, () =>
        Documents.listDocuments(user, opts)
      )
    )
    return NextResponse.json({ items: items.slice(0, limit) })
  } catch (err) {
    const http = handleApiError(err)
    const status = http.status === 500 && http.body.error === 'INTERNAL' && http.body.message === 'REQUEST_TIMEOUT' ? 504 : http.status
    return NextResponse.json(http.body, { status })
  }
}
