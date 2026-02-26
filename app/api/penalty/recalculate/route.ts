import { NextResponse } from 'next/server'
import * as Penalty from '@/services/penalty'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimitCustom, getClientIp } from '@/lib/http/rate-limit'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import { withTimeout } from '@/lib/http/guards'

export async function POST(req: Request) {
  try {
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER'])
    const rl = checkRateLimitCustom(`${getClientIp(req)}:${user.id}:/api/penalty/recalculate:POST`, 5000, 10)
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const result = await withTimeout(10_000, () => Penalty.run(user))
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
