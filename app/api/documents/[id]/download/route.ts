import { NextResponse } from 'next/server'
import * as Documents from '@/services/documents'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import { withTimeout } from '@/lib/http/guards'

export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const rl = checkRateLimit(getClientIp(_req), '/api/documents/[id]/download:GET')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(_req)
    enforceRoleBoundary(user, ['OWNER', 'ADMIN', 'STAFF'])
    const buf = await withTimeout(10_000, () => Documents.getDocumentFile(user, params.id))
    if (!buf) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="document-${params.id}.docx"`
      }
    })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
