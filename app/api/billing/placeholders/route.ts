import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as Placeholders from '@/services/placeholders'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import type { AuthUser } from '@/lib/auth/types'

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
    enforceRoleBoundary(user, ['SUPER_ADMIN', 'FINANCE', 'MANAGER', 'VIEWER', 'STAFF'])
    const url = new URL(req.url)
    const parse = qp.safeParse({
      year: url.searchParams.get('year'),
      month: url.searchParams.get('month'),
      roomNumber: url.searchParams.get('roomNumber') ?? undefined
    })
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid query' }, { status: 422 })
    const { year, month, roomNumber } = parse.data
    const items = await Placeholders.listPlaceholders(user, year, month, roomNumber)
    return NextResponse.json({ items })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
