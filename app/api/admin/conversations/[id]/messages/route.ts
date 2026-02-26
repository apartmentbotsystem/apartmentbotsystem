import { NextResponse } from 'next/server'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import * as AdminConversations from '@/services/adminConversations.service'
import { clampLimitFromRequest, withTimeout } from '@/lib/http/guards'
import { runWithRequestContext } from '@/infrastructure/request-context'

export const runtime = 'nodejs'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/admin/conversations/[id]/messages:GET')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['ADMIN', 'STAFF', 'OWNER'])
    const limit = clampLimitFromRequest(req, 50, 200)
    const items = await withTimeout(10_000, () =>
      runWithRequestContext({ route: '/api/admin/conversations/[id]/messages:GET', userId: user.id }, () =>
        AdminConversations.listMessages(params.id, limit)
      )
    )
    return NextResponse.json({ items })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
