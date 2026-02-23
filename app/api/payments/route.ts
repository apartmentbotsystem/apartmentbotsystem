import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as Payments from '@/services/payments'
import type { AuthUser } from '@/lib/auth/types'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'

export async function GET(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/payments:GET')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER', 'ADMIN'])
    const url = new URL(req.url)
    const year = url.searchParams.get('year')
    const month = url.searchParams.get('month')
    const items = await Payments.listPayments(user, year ? Number(year) : undefined, month ? Number(month) : undefined)
    return NextResponse.json({ items })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}

const schema = z.object({
  amount: z.coerce.number().positive(),
  occurredAt: z.coerce.date(),
  bankRef: z.string().optional()
})

export async function POST(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/payments:POST')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER', 'ADMIN'])
    const body = await req.json()
    const parse = schema.safeParse(body)
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid body' }, { status: 422 })
    const payload: { amount: number; occurredAt: Date; bankRef?: string | null } = {
      amount: parse.data.amount,
      occurredAt: parse.data.occurredAt
    }
    if (parse.data.bankRef !== undefined) payload.bankRef = parse.data.bankRef
    const p = await Payments.createPayment(user, payload, user.id)
    return NextResponse.json({ id: p.id })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
