import { NextResponse } from 'next/server'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as BillingMonths from '@/services/billingMonths'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import type { AuthUser } from '@/lib/auth/types'

export async function GET(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/billing/months:GET')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER', 'ADMIN', 'STAFF'])
    const items = await BillingMonths.listMonthsSummary(user)
    return NextResponse.json({ items })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
