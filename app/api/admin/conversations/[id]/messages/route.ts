import { NextResponse } from 'next/server'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import * as AdminConversations from '@/services/adminConversations.service'

export const runtime = 'nodejs'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/admin/conversations/[id]/messages:GET')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['ADMIN', 'MANAGER', 'STAFF', 'SUPER_ADMIN'])
    const items = await AdminConversations.listMessages(params.id)
    return NextResponse.json({ items })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
