import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import { createHash } from 'node:crypto'
import { hashBillingSnapshot, readDocumentSnapshotMeta } from '@/domain/document/integrity'
import { withTimeout } from '@/lib/http/guards'

export const runtime = 'nodejs'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/documents/[id]/verify:GET')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER', 'ADMIN', 'STAFF'])
    const dv = await withTimeout(10_000, () =>
      prisma.documentVersion.findFirst({
        where: { id: params.id },
        select: { id: true, templateId: true, roomNumber: true, billingMonthId: true, versionNo: true, hash: true, snapshotJson: true }
      })
    )
    if (!dv) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 })
    const meta = readDocumentSnapshotMeta(dv.snapshotJson)
    if (dv.billingMonthId && meta.billingHash) {
      const billingVersionWhere = meta.billingVersionId
          ? { id: meta.billingVersionId }
          : { roomNumber: dv.roomNumber, billingMonthId: dv.billingMonthId as string, isActive: true as const }
      const activeVersion = await withTimeout(10_000, () =>
        prisma.billingVersion.findFirst({
          where: billingVersionWhere,
          orderBy: { versionNo: 'desc' }
        })
      )
      if (!activeVersion) {
        return NextResponse.json({ ok: false, changedAfterSend: true, reason: 'NO_ACTIVE_BILLING_VERSION' })
      }
      const activeHash = hashBillingSnapshot(activeVersion.snapshotData, Number(activeVersion.totalAmount))
      const ok = meta.billingHash === activeHash
      return NextResponse.json({
        ok,
        changedAfterSend: !ok,
        storedBillingHash: meta.billingHash,
        activeBillingHash: activeHash,
        billingVersionId: meta.billingVersionId,
        activeBillingVersionId: activeVersion.id
      })
    }
    let totalAmount = 0
    if (dv.billingMonthId) {
      const activeVersion = await withTimeout(10_000, () => prisma.billingVersion.findFirst({
        where: { roomNumber: dv.roomNumber, billingMonthId: dv.billingMonthId as string, isActive: true },
        orderBy: { versionNo: 'desc' }
      }))
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
    return NextResponse.json({ ok, changedAfterSend: !ok, recomputed, stored: dv.hash })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
