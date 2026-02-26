import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as Billing from '@/services/billing'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimitCustom, getClientIp } from '@/lib/http/rate-limit'
import { withTimeout } from '@/lib/http/guards'
import { verifyCsrf } from '@/lib/http/csrf'

export const runtime = 'nodejs'

const schema = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int(),
  locked: z.boolean()
})

export async function POST(req: Request) {
  try {
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER', 'ADMIN'])
    if (!verifyCsrf(req)) return NextResponse.json({ error: 'CSRF', message: 'Invalid CSRF token' }, { status: 403 })
    const rl = checkRateLimitCustom(`${getClientIp(req)}:${user.id}:/api/billing/lock:POST`, 5000, 10)
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const body = await req.json()
    const parse = schema.safeParse(body)
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid body' }, { status: 422 })
    const { year, month, locked } = parse.data
    const result = await withTimeout(10_000, () => Billing.setBillingMonthLock(user, year, month, locked, user.id))
    return NextResponse.json(result)
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
