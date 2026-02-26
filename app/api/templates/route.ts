import { NextResponse } from 'next/server'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as Templates from '@/services/templates'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { clampLimitFromRequest, withTimeout } from '@/lib/http/guards'
import { runWithRequestContext } from '@/infrastructure/request-context'

export async function GET(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/templates:GET')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['ADMIN', 'OWNER'])
    const limit = clampLimitFromRequest(req, 50, 200)
    const items = await withTimeout(10_000, () =>
      runWithRequestContext({ route: '/api/templates:GET', userId: user.id }, () =>
        Templates.listTemplates(user)
      )
    )
    return NextResponse.json({ items: items.slice(0, limit) })
  } catch (err) {
    const http = handleApiError(err)
    const status = http.status === 500 && http.body.error === 'INTERNAL' && http.body.message === 'REQUEST_TIMEOUT' ? 504 : http.status
    return NextResponse.json(http.body, { status })
  }
}
