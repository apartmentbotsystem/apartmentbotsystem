import { NextResponse } from 'next/server'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as Templates from '@/services/templates'
import { handleApiError } from '@/lib/http/error-handler'
import { z } from 'zod'
import { checkRateLimitCustom, getClientIp } from '@/lib/http/rate-limit'
import { withTimeout } from '@/lib/http/guards'
import { verifyCsrf } from '@/lib/http/csrf'

export const runtime = 'nodejs'

const fileSchema = z.object({
  file: z.custom<Blob>((v) => v instanceof Blob, { message: 'file required' })
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['ADMIN', 'OWNER'])
    if (!verifyCsrf(req)) return NextResponse.json({ error: 'CSRF', message: 'Invalid CSRF token' }, { status: 403 })
    const rl = checkRateLimitCustom(`${getClientIp(req)}:${user.id}:/api/templates/[id]/replace:POST`, 5000, 10)
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const form = await req.formData()
    const parse = fileSchema.safeParse({ file: form.get('file') })
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'file required' }, { status: 422 })
    const out = await withTimeout(10_000, async () => {
      const file = parse.data.file
      const buf = Buffer.from(await file.arrayBuffer())
      return Templates.replaceTemplate(user, params.id, buf, user.id)
    })
    return NextResponse.json(out)
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
