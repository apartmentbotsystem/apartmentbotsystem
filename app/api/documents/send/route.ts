import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as Documents from '@/services/documents'
import { prisma } from '@/lib/db'
import { enqueueDocumentSend } from '@/services/outbox'
import type { AuthUser } from '@/lib/auth/types'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimitCustom, getClientIp } from '@/lib/http/rate-limit'
import * as DocPolicy from '@/policies/documentPolicy'
import * as RolePolicy from '@/policies/rolePolicy'
import { withTimeout } from '@/lib/http/guards'
import { verifyCsrf } from '@/lib/http/csrf'

const schema = z.object({
  documentVersionId: z.string()
})

export async function POST(req: Request) {
  try {
    const user = await requireSession(req)
    RolePolicy.assertRole(user, 'SEND_DOCUMENT')
    if (!verifyCsrf(req)) return NextResponse.json({ error: 'CSRF', message: 'Invalid CSRF token' }, { status: 403 })
    const rl = checkRateLimitCustom(`${getClientIp(req)}:${user.id}:/api/documents/send:POST`, 5000, 10)
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const body = await req.json()
    const parse = schema.safeParse(body)
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid body' }, { status: 422 })
    const { documentVersionId } = parse.data
    const dv = await withTimeout(10_000, () => prisma.documentVersion.findFirst({ where: { id: documentVersionId } }))
    if (!dv) return NextResponse.json({ error: 'NOT_FOUND', message: 'Document not found' }, { status: 404 })
    const ok = await DocPolicy.canSend(dv)
    if (!ok) return NextResponse.json({ error: 'FORBIDDEN', message: 'Document cannot be sent' }, { status: 409 })
    const q = await withTimeout(10_000, () => enqueueDocumentSend({ documentVersionId, roomNumber: dv.roomNumber, billingMonthId: dv.billingMonthId ?? null }))
    return NextResponse.json({ id: documentVersionId, queued: true, status: q.status })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
