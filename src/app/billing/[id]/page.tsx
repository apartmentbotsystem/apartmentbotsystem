'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Invoice Timeline</h2>
      </div>
      {!canView && <div className="text-red-600 text-sm">Forbidden</div>}
      {loading && <div className="text-sm">Loading...</div>}
      {error && <div className="text-red-700 text-sm">{error}</div>}
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
