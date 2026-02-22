import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as Documents from '@/services/documents'
import type { AuthUser } from '@/lib/auth/types'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { ensureIdempotent, sha256Hex } from '@/lib/http/idempotency'

export const runtime = 'nodejs'

const schema = z.object({
  templateId: z.string(),
  roomNumber: z.string(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  force: z.coerce.boolean().optional()
})

export async function POST(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/documents/generate:POST')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['SUPER_ADMIN', 'MANAGER'])
    const form = await req.formData()
    const parse = schema.safeParse({
      templateId: form.get('templateId'),
      roomNumber: form.get('roomNumber'),
      year: form.get('year'),
      month: form.get('month'),
      force: form.get('force')
    })
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid input' }, { status: 422 })
    const { templateId, roomNumber, year, month, force } = parse.data
    const idemKey = req.headers.get('Idempotency-Key')
    const payloadHash = sha256Hex(JSON.stringify({ templateId, roomNumber, year, month, force: !!force, user: user.id }))
    const { reused, result } = await ensureIdempotent('/api/documents/generate', idemKey, payloadHash, async () => {
      return Documents.generateDocument(user, templateId, roomNumber, year, month, force, user.id)
    })
    return NextResponse.json(result)
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
