import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'

export const runtime = 'nodejs'

export async function GET(req: Request, { params }: { params: { key: string } }) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/system/snapshots/[key]:GET')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER', 'ADMIN'])
    const key = decodeURIComponent(params.key)
    const snap = await prisma.systemSnapshot.findFirst({ where: { snapshotKey: key } })
    if (!snap) return NextResponse.json({ ok: false, exists: false }, { status: 404 })
    return NextResponse.json({ ok: true, exists: true, key, createdAt: snap.createdAt.toISOString() })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
