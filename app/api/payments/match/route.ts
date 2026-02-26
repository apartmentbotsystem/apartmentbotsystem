import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as Payments from '@/services/payments'
import type { AuthUser } from '@/lib/auth/types'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp, checkRateLimitCustom } from '@/lib/http/rate-limit'
import { ensureIdempotent, sha256Hex } from '@/lib/http/idempotency'
import { logInfo } from '@/infrastructure/logger'
import { withTimeout } from '@/lib/http/guards'
import { verifyCsrf } from '@/lib/http/csrf'

const schema = z.object({
  paymentId: z.string(),
  billingRecordId: z.string(),
  amount: z.coerce.number().positive(),
  confirm: z.boolean().optional()
})

export async function POST(req: Request) {
  try {
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER', 'ADMIN'])
    if (!verifyCsrf(req)) return NextResponse.json({ error: 'CSRF', message: 'Invalid CSRF token' }, { status: 403 })
    const rl = checkRateLimitCustom(`${getClientIp(req)}:${user.id}:/api/payments/match:POST`, 5000, 10)
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const body = await req.json()
    const parse = schema.safeParse(body)
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid body' }, { status: 422 })
    const { paymentId, billingRecordId, amount, confirm } = parse.data
    const payload: { paymentId: string; billingRecordId: string; amount: number; confirm?: boolean } = {
      paymentId,
      billingRecordId,
      amount
    }
    if (typeof confirm === 'boolean') payload.confirm = confirm
    const idemKey = req.headers.get('Idempotency-Key')
    const payloadHash = sha256Hex(JSON.stringify({ ...payload, confirm: !!confirm, user: user.id }))
    const { result } = await withTimeout(10_000, () => ensureIdempotent('/api/payments/match', idemKey, payloadHash, async () => {
      return Payments.matchPayment(user, payload, user.id)
    }))
    logInfo('payments.match', { userId: user.id, paymentId, billingRecordId, amount, confirm: !!confirm })
    return NextResponse.json(result)
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
