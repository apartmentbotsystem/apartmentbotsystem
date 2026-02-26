import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { toNumberSafe } from '@/lib/decimal'
import { Prisma } from '@prisma/client'
import { DomainError } from '@/domain/errors'
import { withTimeout } from '@/lib/http/guards'
import { verifyCsrf } from '@/lib/http/csrf'

export const runtime = 'nodejs'

const schema = z.object({
  targetVersionId: z.string(),
  reason: z.string().max(500).optional()
})

export async function POST(req: Request, { params }: { params: { roomNumber: string; billingMonthId: string } }) {
  try {
    const rl = checkRateLimit(getClientIp(req), `/api/admin/billing/${params.roomNumber}/${params.billingMonthId}/revert:POST`)
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER'])
    if (!verifyCsrf(req)) return NextResponse.json({ error: 'CSRF', message: 'Invalid CSRF token' }, { status: 403 })
    // Room number validity derives from database only
    const body = await req.json()
    const parse = schema.safeParse(body)
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid body' }, { status: 422 })
    const { targetVersionId, reason } = parse.data
    const target = await withTimeout(10_000, () => prisma.billingVersion.findFirst({
        where: { id: targetVersionId, roomNumber: params.roomNumber, billingMonthId: params.billingMonthId }
      }))
      if (!target) return NextResponse.json({ error: 'NOT_FOUND', message: 'version not found' }, { status: 404 })
      const current = await withTimeout(10_000, () => prisma.billingVersion.findFirst({
        where: { roomNumber: params.roomNumber, billingMonthId: params.billingMonthId, isActive: true },
        orderBy: { versionNo: 'desc' }
      }))
      if (!current) return NextResponse.json({ error: 'CONFLICT', message: 'missing active version' }, { status: 409 })
      const rec = await withTimeout(10_000, () => prisma.billingRecord.findFirst({
        where: { roomNumber: params.roomNumber, billingMonthId: params.billingMonthId },
        include: { room: { select: { id: true } } }
      }))
      if (!rec) return NextResponse.json({ error: 'NOT_FOUND', message: 'record not found' }, { status: 404 })
      const hasMatchedPayment = await withTimeout(10_000, () => prisma.paymentMatch.findFirst({
        where: { billingRecordId: rec.id, confirmed: true }
      }))
      if (hasMatchedPayment) {
        throw new DomainError('PAYMENT_LOCKED', 'Cannot revert billing with matched payment', 409)
      }
      const snap = target.snapshotData as {
        amount?: number | string | { toNumber(): number }
        note?: string | null
        dueDate?: string | Date | null
        penalty?: number | string | { toNumber(): number }
      }
      const updated = await withTimeout(10_000, () => prisma.billingRecord.update({
        where: { id: rec.id },
        data: {
          amount: toNumberSafe(snap.amount ?? rec.amount),
          note: snap.note ?? rec.note,
          dueDate: snap.dueDate ? new Date(snap.dueDate as unknown as string) : rec.dueDate,
          penalty: toNumberSafe(snap.penalty ?? rec.penalty)
        }
      }))
      await withTimeout(10_000, () => prisma.billingVersion.update({ where: { id: current.id }, data: { isActive: false } }))
      const latestVersionNo = current.versionNo
      const totalAmount = toNumberSafe(updated.amount) + toNumberSafe(updated.penalty ?? 0)
      const snapForCreate: Prisma.InputJsonValue = JSON.parse(JSON.stringify(target.snapshotData))
      const newVersion = await withTimeout(10_000, () => prisma.billingVersion.create({
        data: {
          roomId: target.roomId ?? rec.room.id,
          roomNumber: updated.roomNumber,
          billingMonthId: updated.billingMonthId,
          versionNo: latestVersionNo + 1,
          snapshotData: snapForCreate,
          totalAmount,
          createdBy: user.id,
          isActive: true,
          revertedFromId: target.id
        }
      }))
      const payments = await withTimeout(10_000, () => prisma.paymentMatch.findMany({ where: { billingRecordId: updated.id, confirmed: true }, select: { matchedAmount: true } }))
      const paymentTotal = payments.reduce((s, m) => s + toNumberSafe(m.matchedAmount), 0)
      const diff = paymentTotal - totalAmount
      if (Math.abs(diff) > 0) {
        await withTimeout(10_000, () => prisma.financialFlag.create({
          data: {
            roomNumber: updated.roomNumber,
            billingMonthId: updated.billingMonthId,
            type: diff > 0 ? 'OVERPAY_AFTER_BILLING_CHANGE' : 'UNDERPAY_AFTER_BILLING_CHANGE',
            difference: diff
          }
        }))
      }
      await withTimeout(10_000, () => prisma.auditLog.create({
        data: {
          action: 'BILLING_RESTORE_VERSION',
          entityType: 'BillingVersion',
          entityId: newVersion.id,
          data: { roomNumber: updated.roomNumber, billingMonthId: updated.billingMonthId, revertedFromId: target.id, reason: reason ?? null },
          billingRecordId: updated.id
        }
      }))
      const result = { ok: true, versionId: newVersion.id }
    if (result instanceof NextResponse) return result
    return NextResponse.json(result)
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
