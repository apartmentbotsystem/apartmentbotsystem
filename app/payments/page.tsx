import Link from 'next/link'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { getActiveMonth } from '@/lib/context'
import { compareRoomNumbersNatural } from '@/lib/room-sort'
import { getUserFromRequestSync } from '@/lib/auth/session'
import { requireSession } from '@/lib/auth/require-session'
import * as Payments from '@/services/payments'
import { formatYm, getConsumptionYm } from '@/lib/datetime'
import EmptyState from '@/components/system/EmptyState'

type Candidate = {
  billingRecordId: string
  roomNumber: string
  outstanding: number
}

type Suggestion = {
  candidate: Candidate | null
  confidence: number
  reason: string
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'bigint') return Number(v)
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  if (v && typeof v === 'object' && 'toNumber' in v && typeof (v as { toNumber?: unknown }).toNumber === 'function') {
    try {
      const n = Number((v as { toNumber(): number }).toNumber())
      return Number.isFinite(n) ? n : 0
    } catch {
      return 0
    }
  }
  return 0
}

function findRoomInRef(ref: string, rooms: string[]): string | null {
  const text = ref.toLowerCase()
  for (const room of rooms) {
    if (text.includes(room.toLowerCase())) return room
  }
  return null
}

function suggest(paymentจำนวนเงิน: number, bankRef: string | null, candidates: Candidate[]): Suggestion {
  if (!candidates.length) return { candidate: null, confidence: 0, reason: 'ไม่พบใบแจ้งหนี้คงค้าง' }

  const byRoom = [...candidates].sort((a, b) => compareRoomNumbersNatural(a.roomNumber, b.roomNumber))
  const roomHit = bankRef ? findRoomInRef(bankRef, byRoom.map((c) => c.roomNumber)) : null
  if (roomHit) {
    const candidate = byRoom.find((c) => c.roomNumber === roomHit) ?? null
    if (candidate) {
      const diff = Math.abs(candidate.outstanding - paymentจำนวนเงิน)
      if (diff <= 0.01) return { candidate, confidence: 98, reason: 'เลขอ้างอิงตรง + ยอดตรง' }
      return { candidate, confidence: 85, reason: 'เลขอ้างอิงตรงกับห้อง' }
    }
  }

  let best: Candidate | null = null
  let bestDiff = Number.POSITIVE_INFINITY
  for (const c of candidates) {
    const diff = Math.abs(c.outstanding - paymentจำนวนเงิน)
    if (diff < bestDiff) {
      bestDiff = diff
      best = c
    }
  }

  if (!best) return { candidate: null, confidence: 0, reason: 'ไม่พบรายการที่แนะนำ' }
  if (bestDiff <= 0.01) return { candidate: best, confidence: 90, reason: 'ยอดตรง' }
  if (bestDiff <= 50) return { candidate: best, confidence: 70, reason: 'ยอดใกล้เคียง' }
  return { candidate: best, confidence: 45, reason: 'ยอดคล้ายกันเล็กน้อย' }
}

function getCookieHeader(c: Awaited<ReturnType<typeof cookies>>): string {
  return c.getAll().map((item) => `${item.name}=${encodeURIComponent(item.value)}`).join('; ')
}

export default async function PaymentsPage({
  searchParams
}: {
  searchParams: { paymentId?: string; page?: string; take?: string }
}) {
  const { year, month } = await getActiveMonth()
  const cookieStore = await cookies()
  const cookieHeader = getCookieHeader(cookieStore)
  const req = new Request('http://localhost', { headers: { cookie: cookieHeader } })
  const sessionUser = getUserFromRequestSync(req)
  const canMatch = sessionUser?.role === 'OWNER' || sessionUser?.role === 'ADMIN'

  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)
  const page = Math.max(1, Number.parseInt(String(searchParams.page ?? '1'), 10) || 1)
  const rawTake = Number.parseInt(String(searchParams.take ?? '50'), 10)
  const take = Math.min(200, Math.max(1, Number.isFinite(rawTake) ? rawTake : 50))
  const skip = (page - 1) * take

  const [payments, records] = await Promise.all([
    prisma.payment.findMany({
      where: { occurredAt: { gte: start, lt: end } },
      include: {
        matches: {
          include: {
            billingRecord: {
              include: {
                room: { include: { floor: true } }
              }
            }
          }
        }
      },
      orderBy: { occurredAt: 'desc' },
      skip,
      take
    }),
    prisma.billingRecord.findMany({
      where: { billingMonth: { year, month }, status: { not: 'PAID' } },
      include: { room: { include: { floor: true } }, payments: { where: { confirmed: true } } }
    })
  ])

  const candidates: Candidate[] = records
    .map((r) => {
      const paid = r.payments.reduce((sum, m) => sum + toNumber(m.matchedAmount), 0)
      const outstanding = toNumber(r.amount) - paid
      return {
        billingRecordId: r.id,
        roomNumber: r.roomNumber,
        outstanding
      }
    })
    .filter((c) => c.outstanding > 0)

  const currentPaymentId = searchParams.paymentId ?? payments[0]?.id ?? ''
  const current = payments.find((p) => p.id === currentPaymentId) ?? null
  const currentจำนวนเงิน = current ? toNumber(current.amount) : 0
  const currentอ้างอิง = current?.bankRef ?? null
  const suggestion = current ? suggest(currentจำนวนเงิน, currentอ้างอิง, candidates) : null

  async function confirmMatch(formData: FormData) {
    'use server'
    const cookieStore = await cookies()
    const cookieHeader = getCookieHeader(cookieStore)
    const req = new Request('http://localhost', { headers: { cookie: cookieHeader } })
    const user = await requireSession(req)

    const paymentId = String(formData.get('paymentId') ?? '')
    const billingRecordId = String(formData.get('billingRecordId') ?? '')
    const amount = Number(formData.get('amount') ?? 0)
    if (!paymentId || !billingRecordId || !Number.isFinite(amount) || amount <= 0) return

    await Payments.matchPayment(user, { paymentId, billingRecordId, amount, confirm: true }, user.id)

    revalidatePath('/payments')
  }

  const consumptionYm = getConsumptionYm(year, month)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">การชำระเงิน</h1>
          <div className="text-xs opacity-70">บิล เดือน: {formatYm(year, month)} | รอบใช้หน่วย: {consumptionYm}</div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/payments/import" className="btn btn-secondary text-xs">อัปโหลดรายการเดินบัญชี</Link>
          <a href="/api/export/payments" className="btn btn-outline text-xs" target="_blank">Export CSV</a>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-3">
        <div className="md:col-span-7 border erp-border rounded overflow-hidden">
          <div className="px-3 py-2 border-b erp-border text-sm font-semibold">รายการธุรกรรม</div>
          <div className="max-h-[70vh] overflow-auto">
            {payments.length === 0 ? (
              <div className="p-6">
                <EmptyState title="ยังไม่มีธุรกรรมในเดือนนี้" description="นำเข้ารายการเดินบัญชีเพื่อเริ่มจับคู่การชำระเงิน" />
              </div>
            ) : payments.map((p) => {
              const matchedAmount = p.matches.reduce((sum, m) => sum + toNumber(m.matchedAmount), 0)
              const remaining = toNumber(p.amount) - matchedAmount
              const state = p.matches.length === 0 ? 'ยังไม่จับคู่' : remaining <= 0.01 ? 'ยืนยันแล้ว' : 'แนะนำ'
              return (
                <Link
                  key={p.id}
                  href={`/payments?paymentId=${p.id}`}
                  className={`block px-3 py-2 border-b erp-border text-sm hover:bg-[var(--bg-surface)] ${p.id === currentPaymentId ? 'bg-[var(--bg-surface)]' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div>{p.occurredAt.toISOString().slice(0, 10)} • {toNumber(p.amount).toFixed(2)}</div>
                    <span className="chip">{state}</span>
                  </div>
                  <div className="text-xs opacity-70">อ้างอิง: {p.bankRef ?? '-'} | จับคู่แล้ว: {matchedAmount.toFixed(2)}</div>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="md:col-span-5 border erp-border rounded overflow-hidden">
          <div className="px-3 py-2 border-b erp-border text-sm font-semibold">การจับคู่ที่แนะนำ</div>
          {!current && <div className="p-3 text-sm opacity-70">ยังไม่ได้เลือกรายการ</div>}
          {current && (
            <div className="p-3 space-y-3 text-sm">
              <div className="border erp-border rounded p-2">
                <div>จำนวนเงิน: <strong>{currentจำนวนเงิน.toFixed(2)}</strong></div>
                <div>อ้างอิง: <strong>{currentอ้างอิง ?? '-'}</strong></div>
                <div>สถานะ: <strong>{current.matched ? 'จับคู่แล้ว' : 'รอดำเนินการ'}</strong></div>
              </div>

              {suggestion?.candidate ? (
                <div className="border erp-border rounded p-2 space-y-1">
                  <div>ห้อง: <strong>{suggestion.candidate.roomNumber}</strong></div>
                  <div>คงค้าง: <strong>{suggestion.candidate.outstanding.toFixed(2)}</strong></div>
                  <div>ความมั่นใจ: <strong>{suggestion.confidence}%</strong> ({suggestion.reason})</div>
                  {canMatch && (
                    <form action={confirmMatch} className="flex gap-2 items-center pt-1">
                      <input type="hidden" name="paymentId" value={current.id} />
                      <input type="hidden" name="billingRecordId" value={suggestion.candidate.billingRecordId} />
                      <input name="amount" type="number" step="0.01" min={0.01} max={currentจำนวนเงิน} defaultValue={Math.min(currentจำนวนเงิน, suggestion.candidate.outstanding)} className="border erp-border rounded px-2 py-1 w-28" />
                      <button type="submit" className="px-2 py-1 border erp-border rounded">ยืนยัน</button>
                    </form>
                  )}
                </div>
              ) : (
                <div className="text-sm opacity-70">ไม่มีคำแนะนำการจับคู่</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

