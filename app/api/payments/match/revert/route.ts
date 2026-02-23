import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as Payments from '@/services/payments'
import type { AuthUser } from '@/lib/auth/types'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'

const schema = z.object({
  matchId: z.string()
})

export async function POST(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/payments/match/revert:POST')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER', 'ADMIN'])
    const body = await req.json()
    const parse = schema.safeParse(body)
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid body' }, { status: 422 })
    const { matchId } = parse.data
    const result = await Payments.revertMatch(user, matchId, user.id)
    return NextResponse.json(result)
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
