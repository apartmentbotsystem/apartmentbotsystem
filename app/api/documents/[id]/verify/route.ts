import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import { createHash } from 'node:crypto'

export const runtime = 'nodejs'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/documents/[id]/verify:GET')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['SUPER_ADMIN', 'FINANCE', 'MANAGER', 'STAFF', 'ACCOUNTANT'])
    const dv = await prisma.documentVersion.findFirst({
      where: { id: params.id },
      select: { id: true, templateId: true, roomNumber: true, billingMonthId: true, versionNo: true, hash: true }
    })
    if (!dv) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 })
    let totalAmount = 0
    if (dv.billingMonthId) {
      const activeVersion = await prisma.billingVersion.findFirst({
        where: { roomNumber: dv.roomNumber, billingMonthId: dv.billingMonthId, isActive: true },
        orderBy: { versionNo: 'desc' }
      })
      totalAmount = activeVersion ? Number(activeVersion.totalAmount) : 0
    }
    const payloadForHash = JSON.stringify({
      roomNumber: dv.roomNumber,
      billingMonthId: dv.billingMonthId,
      totalAmount,
      versionNo: dv.versionNo,
      templateId: dv.templateId
    })
    const recomputed = createHash('sha256').update(payloadForHash).digest('hex')
    const ok = dv.hash === recomputed
    return NextResponse.json({ ok, recomputed, stored: dv.hash })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
