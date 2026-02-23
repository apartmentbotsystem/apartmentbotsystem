import { NextResponse } from 'next/server'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as Penalty from '@/services/penalty'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import type { AuthUser } from '@/lib/auth/types'

export async function POST(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/admin/maintenance/run-penalty:POST')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER'])
    const result = await Penalty.runWithAudit(user, user.id)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
