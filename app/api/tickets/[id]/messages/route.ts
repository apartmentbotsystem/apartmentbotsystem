import { NextResponse } from 'next/server'
import { z } from 'zod'
import * as Tickets from '@/services/tickets'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimitCustom, getClientIp } from '@/lib/http/rate-limit'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import { withTimeout } from '@/lib/http/guards'
import { verifyCsrf } from '@/lib/http/csrf'

const schema = z.object({
  text: z.string().min(1),
  sender: z.enum(['ADMIN', 'RESIDENT']).default('ADMIN')
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['ADMIN', 'STAFF', 'OWNER'])
    if (!verifyCsrf(req)) return NextResponse.json({ error: 'CSRF', message: 'Invalid CSRF token' }, { status: 403 })
    const rl = checkRateLimitCustom(`${getClientIp(req)}:${user.id}:/api/tickets/[id]/messages:POST`, 5000, 10)
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const body = await req.json()
    const parse = schema.safeParse(body)
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid body' }, { status: 422 })
    const m = await withTimeout(10_000, () => Tickets.addMessage(user, params.id, parse.data.text, parse.data.sender))
    return NextResponse.json(m)
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
