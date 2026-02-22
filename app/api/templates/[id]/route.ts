import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as Templates from '@/services/templates'
import { handleApiError } from '@/lib/http/error-handler'
import type { AuthUser } from '@/lib/auth/types'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/templates/[id]:GET')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['ADMIN', 'MANAGER', 'SUPER_ADMIN'])
    const t = await Templates.getTemplateMeta(user, params.id)
    if (!t) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json(t)
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}

const schema = z.object({
  name: z.string().min(1)
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/templates/[id]:PATCH')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['ADMIN', 'MANAGER', 'SUPER_ADMIN'])
    const body = await req.json()
    const parse = schema.safeParse(body)
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid body' }, { status: 422 })
    const updated = await Templates.renameTemplate(user, params.id, parse.data.name)
    return NextResponse.json(updated)
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
