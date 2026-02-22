import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSession, setSessionCookie } from '@/lib/auth/session'
import { ensureCsrfCookie } from '@/lib/http/csrf'
import { handleApiError } from '@/lib/http/error-handler'

const schema = z.object({
  userId: z.string().min(1),
  role: z.enum(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'STAFF', 'SUPER_ADMIN', 'FINANCE', 'VIEWER']).default('ADMIN'),
  sessionVersion: z.number().int().nonnegative().default(0)
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parse = schema.safeParse(body)
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid body' }, { status: 422 })
    const { userId, role, sessionVersion } = parse.data
    const token = await createSession(userId, role, sessionVersion)
    await setSessionCookie(token)
    await ensureCsrfCookie()
    return NextResponse.json({ ok: true })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}

