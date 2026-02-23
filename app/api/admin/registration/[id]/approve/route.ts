import { NextResponse } from 'next/server'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { approveRegistration } from '@/services/registrationReview.service'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/admin/registration/[id]/approve:POST')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['ADMIN', 'STAFF', 'OWNER'])
    const result = await approveRegistration(params.id)
    return NextResponse.json(result)
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
