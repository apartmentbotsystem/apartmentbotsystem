import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logError } from '@/infrastructure/logger'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { withTimeout } from '@/lib/http/guards'

const schema = z.object({
  message: z.string(),
  stack: z.string().optional(),
  path: z.string().optional(),
  ts: z.string().optional()
})

export async function POST(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/logs/client:POST')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const body = await withTimeout(10_000, () => req.json())
    const parse = schema.safeParse(body)
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid body' }, { status: 422 })
    const payload = parse.data
    logError('client_error', payload as Record<string, unknown>)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
