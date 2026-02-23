import { NextResponse } from 'next/server'
import * as Penalty from '@/services/penalty'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'

export async function POST(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/penalty/recalculate:POST')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER'])
    const result = await Penalty.run(user)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
