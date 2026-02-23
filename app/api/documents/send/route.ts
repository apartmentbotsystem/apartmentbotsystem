import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as Documents from '@/services/documents'
import type { AuthUser } from '@/lib/auth/types'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'

const schema = z.object({
  documentVersionId: z.string()
})

export async function POST(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/documents/send:POST')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['ADMIN', 'STAFF', 'OWNER'])
    const body = await req.json()
    const parse = schema.safeParse(body)
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid body' }, { status: 422 })
    const { documentVersionId } = parse.data
    const result = await Documents.sendDocument(user, documentVersionId, user.id)
    return NextResponse.json(result)
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
