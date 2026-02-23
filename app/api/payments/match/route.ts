import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as Payments from '@/services/payments'
import type { AuthUser } from '@/lib/auth/types'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { ensureIdempotent, sha256Hex } from '@/lib/http/idempotency'
import { logger } from '@/lib/logging/file-logger'

const schema = z.object({
  paymentId: z.string(),
  billingRecordId: z.string(),
  amount: z.coerce.number().positive(),
  confirm: z.boolean().optional()
})

export async function POST(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/payments/match:POST')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER', 'ADMIN'])
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
    const { result } = await ensureIdempotent('/api/payments/match', idemKey, payloadHash, async () => {
      return Payments.matchPayment(user, payload, user.id)
    })
    await logger.info('payments.match', { userId: user.id, paymentId, billingRecordId, amount, confirm: !!confirm })
    return NextResponse.json(result)
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
