import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'

function diffObjects(a: Record<string, unknown>, b: Record<string, unknown>) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})])
  const out: Record<string, { from: unknown; to: unknown }> = {}
  for (const k of keys) {
    const va = (a as any)[k]
    const vb = (b as any)[k]
    const same = JSON.stringify(va) === JSON.stringify(vb)
    if (!same) out[k] = { from: va, to: vb }
  }
  return out
}

export async function GET(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/audit/diff:GET')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['SUPER_ADMIN', 'FINANCE', 'MANAGER', 'VIEWER'])
    const url = new URL(req.url)
    const v1 = url.searchParams.get('v1')
    const v2 = url.searchParams.get('v2')
    if (!v1 || !v2) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'v1 and v2 required' }, { status: 422 })
    const a = await prisma.billingVersion.findFirst({ where: { id: v1 } })
    const b = await prisma.billingVersion.findFirst({ where: { id: v2 } })
    if (!a || !b) return NextResponse.json({ error: 'NOT_FOUND', message: 'version not found' }, { status: 404 })
    const da = (a.snapshotData as any) ?? {}
    const db = (b.snapshotData as any) ?? {}
    const diffs = diffObjects(da, db)
    return NextResponse.json({ diffs, meta: { a: { id: a.id, versionNo: a.versionNo }, b: { id: b.id, versionNo: b.versionNo } } })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
