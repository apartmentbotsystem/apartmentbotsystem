import { NextResponse } from 'next/server'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as Templates from '@/services/templates'
import { handleApiError } from '@/lib/http/error-handler'
import { z } from 'zod'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'

export const runtime = 'nodejs'

const fileSchema = z.object({
  file: z.custom<Blob>((v) => v instanceof Blob, { message: 'file required' })
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/templates/[id]/replace:POST')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['ADMIN', 'OWNER'])
    const form = await req.formData()
    const parse = fileSchema.safeParse({ file: form.get('file') })
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'file required' }, { status: 422 })
    const file = parse.data.file
    const buf = Buffer.from(await file.arrayBuffer())
    const out = await Templates.replaceTemplate(user, params.id, buf, user.id)
    return NextResponse.json(out)
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
