'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Role = 'ADMIN' | 'STAFF' | null

type TimelineItem = {
  action: string
  timestamp: string
  actor: 'ADMIN' | 'SYSTEM'
  metadata: Record<string, unknown>
}

async function fetchEnvelope<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...(init?.headers || {}), accept: 'application/vnd.apartment.v1.1+json' }, cache: 'no-store' })
  const json = await res.json()
  if (json.success) return json.data as T
  throw new Error(json.error?.message || 'Error')
}

export default function BillingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [role, setRole] = useState<Role>(null)
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [confirmNote, setConfirmNote] = useState<string>('')
  const router = useRouter()

  const canView = useMemo(() => role === 'ADMIN', [role])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const p = await params
      const sess = await fetchEnvelope<{ userId: string | null; role: 'ADMIN' | 'STAFF' | null }>('/api/auth/session')
      setRole(sess?.role ?? null)
      const data = await fetchEnvelope<{ items: TimelineItem[] }>(`/api/admin/invoices/${encodeURIComponent(p.id)}/timeline`)
      setItems(Array.isArray(data.items) ? data.items : [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    load()
  }, [load])

  const hasReported = useMemo(() => items.some((it) => it.action === 'PAYMENT_REPORTED'), [items])
  const hasPaid = useMemo(() => items.some((it) => it.action === 'INVOICE_PAID'), [items])
  const latestReportedAt = useMemo(() => {
    const arr = items.filter((it) => it.action === 'PAYMENT_REPORTED')
    if (arr.length === 0) return null
    const last = arr.reduce((a, b) => (new Date(a.timestamp).getTime() >= new Date(b.timestamp).getTime() ? a : b))
    return last.timestamp
  }, [items])

  const confirmPayment = useCallback(async () => {
    if (!canView || confirming) return
    setConfirmError(null)
    setConfirming(true)
    try {
      const p = await params
      await fetchEnvelope(`/api/admin/invoices/${encodeURIComponent(p.id)}/confirm-payment`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paymentNote: confirmNote || undefined }),
      })
      router.push('/admin/payments/reported')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setConfirmError(msg)
    } finally {
      setConfirming(false)
    }
  }, [canView, confirming, confirmNote, params, router])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Invoice Timeline</h2>
      </div>
      {!canView && <div className="text-red-600 text-sm">Forbidden</div>}
      {loading && <div className="text-sm">Loading...</div>}
      {error && <div className="text-red-700 text-sm">{error}</div>}
      {!loading && canView && hasReported && !hasPaid && (
        <div className="rounded border border-yellow-300 bg-yellow-100 px-3 py-2 text-sm">
          <div>มีการแจ้งโอนผ่าน LINE เมื่อ {latestReportedAt ? new Date(latestReportedAt).toLocaleString() : '-'}</div>
          <div className="mt-2 flex items-end gap-2">
            <div className="flex flex-col">
              <label className="text-xs">หมายเหตุยืนยัน</label>
              <input
                value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)}
                className="border rounded px-2 py-1"
                placeholder="เช่น ยืนยันโดยแอดมิน"
              />
            </div>
            <button
              className="rounded bg-slate-800 px-3 py-2 text-white disabled:opacity-50"
              disabled={confirming}
              onClick={confirmPayment}
            >
              ยืนยันการชำระเงิน
            </button>
          </div>
          {confirmError && <div className="mt-2 text-red-700">{confirmError}</div>}
        </div>
      )}
      {!loading && canView && (
        <div className="space-y-4">
          {items.map((it, idx) => (
            <div key={`${it.action}-${it.timestamp}-${idx}`} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-blue-600" />
                {idx < items.length - 1 && <div className="w-[2px] h-6 bg-gray-300" />}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{it.action}</div>
                <div className="text-xs text-gray-600">
                  {new Date(it.timestamp).toLocaleString()} • {it.actor}
                </div>
                {it.action === 'INVOICE_PAID' && typeof it.metadata?.paymentNote === 'string' && it.metadata.paymentNote.length > 0 && (
                  <div className="mt-1 text-sm">Note: {String(it.metadata.paymentNote)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
