import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { toNumberSafe } from '@/lib/decimal'
import { Prisma } from '@prisma/client'
import { DomainError } from '@/domain/errors'

export const runtime = 'nodejs'

const schema = z.object({
  targetVersionId: z.string()
})

export async function POST(req: Request, { params }: { params: { roomNumber: string; billingMonthId: string } }) {
  try {
    const rl = checkRateLimit(getClientIp(req), `/api/admin/billing/${params.roomNumber}/${params.billingMonthId}/revert:POST`)
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['SUPER_ADMIN', 'FINANCE'])
    const body = await req.json()
    const parse = schema.safeParse(body)
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid body' }, { status: 422 })
    const { targetVersionId } = parse.data
    const target = await prisma.billingVersion.findFirst({
        where: { id: targetVersionId, roomNumber: params.roomNumber, billingMonthId: params.billingMonthId }
      })
      if (!target) return NextResponse.json({ error: 'NOT_FOUND', message: 'version not found' }, { status: 404 })
      const current = await prisma.billingVersion.findFirst({
        where: { roomNumber: params.roomNumber, billingMonthId: params.billingMonthId, isActive: true },
        orderBy: { versionNo: 'desc' }
      })
      if (!current) return NextResponse.json({ error: 'CONFLICT', message: 'missing active version' }, { status: 409 })
      const rec = await prisma.billingRecord.findFirst({
        where: { roomNumber: params.roomNumber, billingMonthId: params.billingMonthId }
      })
      if (!rec) return NextResponse.json({ error: 'NOT_FOUND', message: 'record not found' }, { status: 404 })
      const hasMatchedPayment = await prisma.paymentMatch.findFirst({
        where: { billingRecordId: rec.id, confirmed: true }
      })
      if (hasMatchedPayment) {
        throw new DomainError('PAYMENT_LOCKED', 'Cannot revert billing with matched payment', 409)
      }
      const snap = target.snapshotData as {
        amount?: number | string | { toNumber(): number }
        adjustments?: number | string | { toNumber(): number }
        note?: string | null
        dueDate?: string | Date | null
        penalty?: number | string | { toNumber(): number }
      }
      const updated = await prisma.billingRecord.update({
        where: { id: rec.id },
        data: {
          amount: toNumberSafe(snap.amount ?? rec.amount),
          adjustments: toNumberSafe(snap.adjustments ?? rec.adjustments),
          note: snap.note ?? rec.note,
          dueDate: snap.dueDate ? new Date(snap.dueDate as unknown as string) : rec.dueDate,
          penalty: toNumberSafe(snap.penalty ?? rec.penalty)
        }
      })
      await prisma.billingVersion.update({ where: { id: current.id }, data: { isActive: false } })
      const latestVersionNo = current.versionNo
      const totalAmount = toNumberSafe(updated.amount) + toNumberSafe(updated.adjustments) + toNumberSafe(updated.penalty ?? 0)
      const snapForCreate: Prisma.InputJsonValue = JSON.parse(JSON.stringify(target.snapshotData))
      const newVersion = await prisma.billingVersion.create({
        data: {
          roomNumber: updated.roomNumber,
          billingMonthId: updated.billingMonthId,
          versionNo: latestVersionNo + 1,
          snapshotData: snapForCreate,
          totalAmount,
          createdBy: user.id,
          isActive: true,
          revertedFromId: target.id
        }
      })
      const payments = await prisma.paymentMatch.findMany({ where: { billingRecordId: updated.id, confirmed: true }, select: { matchedAmount: true } })
      const paymentTotal = payments.reduce((s, m) => s + toNumberSafe(m.matchedAmount), 0)
      const diff = paymentTotal - totalAmount
      if (Math.abs(diff) > 0) {
        await prisma.financialFlag.create({
          data: {
            roomNumber: updated.roomNumber,
            billingMonthId: updated.billingMonthId,
            type: diff > 0 ? 'OVERPAY_AFTER_BILLING_CHANGE' : 'UNDERPAY_AFTER_BILLING_CHANGE',
            difference: diff
          }
        })
      }
      const result = { ok: true, versionId: newVersion.id }
    if (result instanceof NextResponse) return result
    return NextResponse.json(result)
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
