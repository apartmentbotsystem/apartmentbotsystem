import { NextResponse } from 'next/server'
import { z } from 'zod'
import * as Line from '@/services/line'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import { withTimeout } from '@/lib/http/guards'

const schema = z.object({
  lineUserId: z.string(),
  residentId: z.string()
})

export async function POST(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/line/bind:POST')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER', 'ADMIN', 'STAFF'])
    const body = await req.json()
    const parse = schema.safeParse(body)
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid body' }, { status: 422 })
    const { lineUserId, residentId } = parse.data
    const binding = await withTimeout(10_000, () => Line.createBinding(user, lineUserId, residentId))
    return NextResponse.json({ id: binding.id })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
