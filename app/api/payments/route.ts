import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as Payments from '@/services/payments'
import type { AuthUser } from '@/lib/auth/types'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp, checkRateLimitCustom } from '@/lib/http/rate-limit'
import { clampLimitFromRequest, withTimeout } from '@/lib/http/guards'
import { runWithRequestContext } from '@/infrastructure/request-context'

export async function GET(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/payments:GET')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER', 'ADMIN'])
    const url = new URL(req.url)
    const year = url.searchParams.get('year')
    const month = url.searchParams.get('month')
    const limit = clampLimitFromRequest(req, 50, 200)
    const items = await withTimeout(10_000, () =>
      runWithRequestContext({ route: '/api/payments:GET', userId: user.id }, () =>
        Payments.listPayments(user, year ? Number(year) : undefined, month ? Number(month) : undefined)
      )
    )
    return NextResponse.json({ items: items.slice(0, limit) })
  } catch (err) {
    const http = handleApiError(err)
    const status = http.status === 500 && http.body.error === 'INTERNAL' && http.body.message === 'REQUEST_TIMEOUT' ? 504 : http.status
    return NextResponse.json(http.body, { status })
  }
}

const schema = z.object({
  amount: z.coerce.number().positive(),
  occurredAt: z.coerce.date(),
  bankRef: z.string().optional()
})

export async function POST(req: Request) {
  try {
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER', 'ADMIN'])
    const ip = getClientIp(req)
    const rl = checkRateLimitCustom(`${ip}:${user.id}:/api/payments:POST`, 5000, 10)
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const body = await req.json()
    const parse = schema.safeParse(body)
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid body' }, { status: 422 })
    const payload: { amount: number; occurredAt: Date; bankRef?: string | null } = {
      amount: parse.data.amount,
      occurredAt: parse.data.occurredAt
    }
    if (parse.data.bankRef !== undefined) payload.bankRef = parse.data.bankRef
    const p = await withTimeout(10_000, () =>
      runWithRequestContext({ route: '/api/payments:POST', userId: user.id }, () =>
        Payments.createPayment(user, payload, user.id)
      )
    )
    return NextResponse.json({ id: p.id })
  } catch (err) {
    const http = handleApiError(err)
    const status = http.status === 500 && http.body.error === 'INTERNAL' && http.body.message === 'REQUEST_TIMEOUT' ? 504 : http.status
    return NextResponse.json(http.body, { status })
  }
}
