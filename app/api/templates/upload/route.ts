import { NextResponse } from 'next/server'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as Templates from '@/services/templates'
import { handleApiError } from '@/lib/http/error-handler'
import type { AuthUser } from '@/lib/auth/types'
import { z } from 'zod'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'

export const runtime = 'nodejs'

const schema = z.object({
  code: z.string().min(1),
  name: z.string().optional()
})
const fileSchema = z.object({
  file: z.custom<Blob>((v) => v instanceof Blob, { message: 'file required' })
})

export async function POST(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/templates/upload:POST')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['ADMIN', 'OWNER'])
    const form = await req.formData()
    const parsedFile = fileSchema.safeParse({ file: form.get('file') })
    if (!parsedFile.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'file is required' }, { status: 422 })
    const parsedFields = schema.safeParse({ code: form.get('code'), name: form.get('name') })
    if (!parsedFields.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'code is required' }, { status: 422 })
    const code = parsedFields.data.code.trim()
    const name = (parsedFields.data.name ?? '').trim() || code
    const file = parsedFile.data.file
    const buf = Buffer.from(await file.arrayBuffer())
    const out = await Templates.uploadOrUpdateTemplate(user, code, name, buf, user.id)
    return NextResponse.json(out)
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
