import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as Billing from '@/services/billing'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import type { BillingRecord } from '@prisma/client'
import type { AuthUser } from '@/lib/auth/types'
import { logInfo } from '@/infrastructure/logger'
import { clampLimitFromRequest, withTimeout } from '@/lib/http/guards'
import { runWithRequestContext } from '@/infrastructure/request-context'
import { verifyCsrf } from '@/lib/http/csrf'

export const runtime = 'nodejs'

const qp = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int()
})

export async function GET(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/billing/records:GET')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER', 'ADMIN', 'STAFF'])
    const url = new URL(req.url)
    const parse = qp.safeParse({
      year: url.searchParams.get('year'),
      month: url.searchParams.get('month')
    })
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid query' }, { status: 422 })
    const { year, month } = parse.data
    const limit = clampLimitFromRequest(req, 50, 200)
    const records = await withTimeout(10_000, () =>
      runWithRequestContext({ route: '/api/billing/records:GET', userId: user.id }, () =>
        Billing.listBillingRecords(user, year, month)
      )
    )
    const items = records.map((r: BillingRecord) => ({
      id: r.id,
      roomNumber: r.roomNumber,
      rent: Number(r.rent ?? 0),
      water: Number(r.water ?? 0),
      electric: Number(r.electric ?? 0),
      other: Number(r.other ?? 0),
      amount: Number(r.amount),
      note: r.note ?? '',
      raw: r.raw ?? null,
      dueDate: r.dueDate ?? null,
      overdueDays: r.overdueDays,
      penalty: Number(r.penalty ?? 0),
      status: r.status
    })).slice(0, limit)
    return NextResponse.json({ items })
  } catch (err) {
    const http = handleApiError(err)
    const status = http.status === 500 && http.body.error === 'INTERNAL' && http.body.message === 'REQUEST_TIMEOUT' ? 504 : http.status
    return NextResponse.json(http.body, { status })
  }
}

const patchSchema = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int(),
  rows: z.array(z.object({
    id: z.string(),
    rent: z.coerce.number(),
    water: z.coerce.number(),
    electric: z.coerce.number(),
    other: z.coerce.number(),
    amount: z.coerce.number().optional(),
    note: z.string().nullable().optional(),
    raw: z.record(z.string(), z.unknown()).nullable().optional()
  }))
})

export async function PATCH(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/billing/records:PATCH')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER', 'ADMIN'])
    if (!verifyCsrf(req)) return NextResponse.json({ error: 'CSRF', message: 'Invalid CSRF token' }, { status: 403 })
    const body = await req.json()
    const parse = patchSchema.safeParse(body)
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid body' }, { status: 422 })
    const { year, month, rows } = parse.data
    // Input validation guard: reject negative components
    for (const r of rows) {
      if (r.rent < 0 || r.water < 0 || r.electric < 0 || r.other < 0 || (r.amount != null && r.amount < 0)) {
        return NextResponse.json({ error: 'INVALID_INPUT', message: 'Negative values are not allowed' }, { status: 400 })
      }
    }
    const result = await withTimeout(10_000, () =>
      runWithRequestContext({ route: '/api/billing/records:PATCH', userId: user.id }, () =>
        Billing.patchBillingRecords(
          user,
          year,
          month,
          rows.map(r => ({
            id: r.id,
            rent: r.rent,
            water: r.water,
            electric: r.electric,
            other: r.other,
            amount: r.amount,
            note: r.note ?? null,
            raw: (r.raw ?? null) as Record<string, unknown> | null
          })),
          user.id
        )
      )
    )
    logInfo('billing.patch', { userId: user.id, year, month, rows: rows.length })
    return NextResponse.json(result)
  } catch (err) {
    const http = handleApiError(err)
    const status = http.status === 500 && http.body.error === 'INTERNAL' && http.body.message === 'REQUEST_TIMEOUT' ? 504 : http.status
    return NextResponse.json(http.body, { status })
  }
}
