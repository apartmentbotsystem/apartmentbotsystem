import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as Billing from '@/services/billing'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import type { BillingRecord } from '@prisma/client'
import type { AuthUser } from '@/lib/auth/types'

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
    enforceRoleBoundary(user, ['SUPER_ADMIN', 'FINANCE', 'MANAGER', 'VIEWER'])
    const url = new URL(req.url)
    const parse = qp.safeParse({
      year: url.searchParams.get('year'),
      month: url.searchParams.get('month')
    })
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid query' }, { status: 422 })
    const { year, month } = parse.data
    const records = await Billing.listBillingRecords(user, year, month)
    const items = records.map((r: BillingRecord) => ({
      id: r.id,
      roomNumber: r.roomNumber,
      amount: Number(r.amount),
      adjustments: Number(r.adjustments),
      note: r.note ?? '',
      dueDate: r.dueDate ?? null,
      overdueDays: r.overdueDays,
      penalty: Number(r.penalty ?? 0),
      status: r.status
    }))
    return NextResponse.json({ items })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}

const patchSchema = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int(),
  rows: z.array(z.object({
    id: z.string(),
    amount: z.coerce.number(),
    adjustments: z.coerce.number(),
    note: z.string().nullable().optional()
  }))
})

export async function PATCH(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/billing/records:PATCH')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['SUPER_ADMIN', 'FINANCE'])
    const body = await req.json()
    const parse = patchSchema.safeParse(body)
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid body' }, { status: 422 })
    const { year, month, rows } = parse.data
    const result = await Billing.patchBillingRecords(
      user,
      year,
      month,
      rows.map(r => ({ id: r.id, amount: r.amount, adjustments: r.adjustments, note: r.note ?? null })),
      user.id
    )
    return NextResponse.json(result)
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
