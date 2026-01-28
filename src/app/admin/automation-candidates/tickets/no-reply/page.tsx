'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { z } from 'zod'
import { TicketsNoReplyCandidatesDTO } from '@/interface/validators/report.schema'

type Role = 'ADMIN' | 'STAFF' | null
type Item = z.infer<typeof TicketsNoReplyCandidatesDTO>['items'][number]

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
  if (days >= 14) return 'critical'
  if (days >= 7) return 'attention'
  return 'warning'
}

export function NoReplyListView(props: {
  items: Item[]
  loading: boolean
  error: string | null
  thresholdDays: number
  onThresholdDaysChange?: (v: number) => void
}) {
  const sorted = (() => {
    const arr = [...props.items]
    const out: Item[] = []
    while (arr.length > 0) {
      let idx = 0
      for (let i = 1; i < arr.length; i++) {
        if (arr[i].daysOpen > arr[idx].daysOpen) idx = i
      }
      out.push(arr[idx])
      arr.splice(idx, 1)
    }
    return out
  })()
  return (
    <div className="p-4 space-y-4">
      <h2 className="font-semibold text-lg">Automation Candidates: Tickets No-Reply</h2>
      <div className="flex gap-3 items-center">
        <label className="text-sm">Threshold Days</label>
        <input
          type="number"
          min={0}
          value={props.thresholdDays}
          onChange={(e) => props.onThresholdDaysChange && props.onThresholdDaysChange(Number(e.target.value))}
          className="border rounded px-2 py-1 w-24"
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
              <th className="text-left p-2 border-b">Ticket</th>
              <th className="text-left p-2 border-b">Days Open</th>
              <th className="text-left p-2 border-b">Last Reply</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((it) => {
              const sev = severity(it.daysOpen)
              return (
                <tr key={it.ticketId} className="border-b">
                  <td className="p-2">
                    {sev === 'warning' ? (
                      <span className="rounded px-2 py-1 bg-yellow-100">🟡 Warning</span>
                    ) : sev === 'attention' ? (
                      <span className="rounded px-2 py-1 bg-orange-100">🟠 Attention</span>
                    ) : (
                      <span className="rounded px-2 py-1 bg-red-100">🔴 Critical</span>
                    )}
                  </td>
                  <td className="p-2">{it.ticketId}</td>
                  <td className="p-2">{it.daysOpen}</td>
                  <td className="p-2">{it.lastReplyAt ? new Date(it.lastReplyAt).toLocaleString() : 'No replies yet'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : null}
    </div>
  )
}

export default function NoReplyPage() {
  const [role, setRole] = useState<Role>(null)
  const [thresholdDays, setThresholdDays] = useState<number>(3)
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
      const data = await fetchAny<{ items: Item[] }>(
        `/api/admin/automation-candidates/tickets/no-reply?thresholdDays=${encodeURIComponent(thresholdDays)}`,
      )
      setItems(Array.isArray(data.items) ? data.items : [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [thresholdDays])
  useEffect(() => {
    load()
  }, [load])
  if (!canView) return <div className="p-4 text-red-600">ต้องเป็น Admin เท่านั้น</div>
  return (
    <NoReplyListView
      items={items}
      loading={loading}
      error={error}
      thresholdDays={thresholdDays}
      onThresholdDaysChange={setThresholdDays}
    />
  )
}
