'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { z } from 'zod'
import { UnpaidSentInvoicesOlderThanDTO } from '@/interface/validators/report.schema'

type Role = 'ADMIN' | 'STAFF' | null
type Item = z.infer<typeof UnpaidSentInvoicesOlderThanDTO>['items'][number]

function fetchAny<T>(url: string, init?: RequestInit): Promise<T> {
  return fetch(url, {
    ...init,
    headers: { ...(init?.headers || {}), accept: 'application/vnd.apartment.v1.1+json' },
    cache: 'no-store',
  })
    .then((res) => res.json())
    .then((json) => {
      if (json && typeof json === 'object' && 'success' in json) {
        if (json.success) return json.data as T
        const message = (json.error && json.error.message) || 'Error'
        throw new Error(String(message))
      }
      return json as T
    })
}

function severity(days: number): 'warning' | 'attention' | 'critical' {
  if (days >= 30) return 'critical'
  if (days >= 14) return 'attention'
  return 'warning'
}

export function UnpaidOldListView(props: {
  items: Item[]
  loading: boolean
  error: string | null
  minDays: number
  onMinDaysChange?: (v: number) => void
  period?: string
  onPeriodChange?: (v: string) => void
  now?: Date
}) {
  const now = props.now || new Date()
  const sorted = (() => {
    const arr = [...props.items]
    const out: Item[] = []
    while (arr.length > 0) {
      let idx = 0
      for (let i = 1; i < arr.length; i++) {
        if (arr[i].daysSinceSent > arr[idx].daysSinceSent) idx = i
      }
      out.push(arr[idx])
      arr.splice(idx, 1)
    }
    return out
  })()
  return (
    <div className="p-4 space-y-4">
      <h2 className="font-semibold text-lg">Automation Candidates: Unpaid Sent Invoices</h2>
      <div className="flex gap-3 items-center">
        <label className="text-sm">Min Days</label>
        <input
          type="number"
          min={0}
          value={props.minDays}
          onChange={(e) => props.onMinDaysChange && props.onMinDaysChange(Number(e.target.value))}
          className="border rounded px-2 py-1 w-24"
        />
        <label className="text-sm">Period</label>
        <input
          type="month"
          value={props.period || ''}
          onChange={(e) => props.onPeriodChange && props.onPeriodChange(e.target.value)}
          className="border rounded px-2 py-1"
        />
      </div>
      {props.error ? <div className="text-red-600">{props.error}</div> : null}
      {props.loading ? <div>กำลังโหลด...</div> : null}
      {sorted.length === 0 && !props.loading ? <div>ไม่มีข้อมูล</div> : null}
      {sorted.length > 0 ? (
        <table className="w-full border border-slate-300">
          <thead className="bg-slate-100">
            <tr>
              <th className="text-left p-2 border-b">Severity</th>
              <th className="text-left p-2 border-b">Invoice</th>
              <th className="text-left p-2 border-b">Days Since Sent</th>
              <th className="text-left p-2 border-b">Sent At</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((it) => {
              const sev = severity(it.daysSinceSent)
              const sent = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - it.daysSinceSent))
              return (
                <tr key={it.invoiceId} className="border-b">
                  <td className="p-2">
                    {sev === 'warning' ? (
                      <span className="rounded px-2 py-1 bg-yellow-100">🟡 Warning</span>
                    ) : sev === 'attention' ? (
                      <span className="rounded px-2 py-1 bg-orange-100">🟠 Attention</span>
                    ) : (
                      <span className="rounded px-2 py-1 bg-red-100">🔴 Critical</span>
                    )}
                  </td>
                  <td className="p-2">{it.invoiceId}</td>
                  <td className="p-2">{it.daysSinceSent}</td>
                  <td className="p-2">{sent.toISOString().slice(0, 10)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : null}
    </div>
  )
}

export default function UnpaidOldPage() {
  const [role, setRole] = useState<Role>(null)
  const [minDays, setMinDays] = useState<number>(7)
  const [period, setPeriod] = useState<string>('')
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canView = useMemo(() => role === 'ADMIN', [role])
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sess = await fetchAny<{ userId: string | null; role: Role }>('/api/auth/session')
      setRole(sess?.role ?? null)
      const qs = new URLSearchParams()
      qs.set('minDays', String(minDays))
      if (period) qs.set('period', period)
      const data = await fetchAny<{ items: Item[] }>(
        `/api/admin/automation-candidates/invoices/unpaid-old?${qs.toString()}`,
      )
      setItems(Array.isArray(data.items) ? data.items : [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [minDays, period])
  useEffect(() => {
    load()
  }, [load])
  if (!canView) return <div className="p-4 text-red-600">ต้องเป็น Admin เท่านั้น</div>
  return (
    <UnpaidOldListView
      items={items}
      loading={loading}
      error={error}
      minDays={minDays}
      onMinDaysChange={setMinDays}
      period={period}
      onPeriodChange={setPeriod}
    />
  )
}
