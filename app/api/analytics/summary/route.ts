import { NextResponse } from 'next/server'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as Analytics from '@/services/analytics'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { withTimeout } from '@/lib/http/guards'

export async function GET(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/analytics/summary:GET')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['ADMIN', 'OWNER'])
    const summary = await withTimeout(10_000, () => Analytics.getSummary(user))
    return NextResponse.json(summary)
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
