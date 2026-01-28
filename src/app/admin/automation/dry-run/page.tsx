'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { z } from 'zod'
import { AutomationDryRunResponseDTO, AutomationProposalDTO } from '@/interface/validators/report.schema'

type Role = 'ADMIN' | 'STAFF' | null
type Proposal = z.infer<typeof AutomationProposalDTO>

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

function badge(sev: Proposal['severity']) {
  if (sev === 'LOW') return <span className="rounded px-2 py-1 bg-yellow-100">🟡 Low</span>
  if (sev === 'MEDIUM') return <span className="rounded px-2 py-1 bg-orange-100">🟠 Medium</span>
  return <span className="rounded px-2 py-1 bg-red-100">🔴 High</span>
}

export function ProposalsListView(props: {
  proposals: Proposal[]
  loading: boolean
  error: string | null
  period: string
  onPeriodChange?: (v: string) => void
  minOverdueDays: number
  onMinOverdueDaysChange?: (v: number) => void
  thresholdDays: number
  onThresholdDaysChange?: (v: number) => void
  onPreview?: (p: Proposal) => void
  onMarkReviewed?: (id: string) => void
  reviewedIds?: Set<string>
}) {
  const sorted = (() => {
    const arr = [...props.proposals]
    const out: Proposal[] = []
    while (arr.length > 0) {
      let idx = 0
      for (let i = 1; i < arr.length; i++) {
        const ai = arr[i]
        const ax = arr[idx]
        const sevScore = (s: Proposal['severity']) => (s === 'HIGH' ? 3 : s === 'MEDIUM' ? 2 : 1)
        const bi = sevScore(ai.severity)
        const bx = sevScore(ax.severity)
        if (bi > bx) idx = i
      }
      out.push(arr[idx])
      arr.splice(idx, 1)
    }
    return out
  })()
  return (
    <div className="p-4 space-y-4">
      <h2 className="font-semibold text-lg">Automation Dry-Run (Preview Only)</h2>
      <div className="flex gap-3 items-center">
        <label className="text-sm">Period</label>
        <input
          type="month"
          value={props.period}
          onChange={(e) => props.onPeriodChange && props.onPeriodChange(e.target.value)}
          className="border rounded px-2 py-1"
        />
        <label className="text-sm">Min Overdue Days</label>
        <input
          type="number"
          min={0}
          value={props.minOverdueDays}
          onChange={(e) => props.onMinOverdueDaysChange && props.onMinOverdueDaysChange(Number(e.target.value))}
          className="border rounded px-2 py-1 w-28"
        />
        <label className="text-sm">Threshold Days (Tickets)</label>
        <input
          type="number"
          min={0}
          value={props.thresholdDays}
          onChange={(e) => props.onThresholdDaysChange && props.onThresholdDaysChange(Number(e.target.value))}
          className="border rounded px-2 py-1 w-28"
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
              <th className="text-left p-2 border-b">Type</th>
              <th className="text-left p-2 border-b">Target</th>
              <th className="text-left p-2 border-b">Reason</th>
              <th className="text-left p-2 border-b">Generated</th>
              <th className="text-left p-2 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const reviewed = props.reviewedIds?.has(p.id) ?? false
              return (
                <tr key={p.id} className="border-b">
                  <td className="p-2">{badge(p.severity)}</td>
                  <td className="p-2">{p.type}</td>
                  <td className="p-2">{p.targetId}</td>
                  <td className="p-2">{p.reason}</td>
                  <td className="p-2">{new Date(p.generatedAt).toLocaleString()}</td>
                  <td className="p-2 space-x-2">
                    <button className="px-3 py-1 rounded bg-slate-200" onClick={() => props.onPreview && props.onPreview(p)}>
                      👀 Preview
                    </button>
                    <button
                      className={`px-3 py-1 rounded ${reviewed ? 'bg-green-600 text-white' : 'bg-slate-200'}`}
                      onClick={() => props.onMarkReviewed && props.onMarkReviewed(p.id)}
                    >
                      📝 Mark as Reviewed
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : null}
    </div>
  )
}

function getCurrentMonth(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export default function AutomationDryRunPage() {
  const [role, setRole] = useState<Role>(null)
  const [period, setPeriod] = useState<string>(getCurrentMonth())
  const [minOverdueDays, setMinOverdueDays] = useState<number>(4)
  const [thresholdDays, setThresholdDays] = useState<number>(3)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Proposal | null>(null)
  const [reviewed, setReviewed] = useState<Set<string>>(new Set())
  const canView = useMemo(() => role === 'ADMIN', [role])
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sess = await fetchAny<{ userId: string | null; role: Role }>('/api/auth/session')
      setRole(sess?.role ?? null)
      const qs = new URLSearchParams()
      qs.set('minOverdueDays', String(minOverdueDays))
      qs.set('thresholdDays', String(thresholdDays))
      if (period) qs.set('period', period)
      const data = await fetchAny<{ proposals: Proposal[] }>(`/api/admin/automation/dry-run?${qs.toString()}`)
      const parsed = AutomationDryRunResponseDTO.parse(data)
      setProposals(Array.isArray(parsed.proposals) ? parsed.proposals : [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setProposals([])
    } finally {
      setLoading(false)
    }
  }, [period, minOverdueDays, thresholdDays])
  useEffect(() => {
    load()
  }, [load])
  if (!canView) return <div className="p-4 text-red-600">ต้องเป็น Admin เท่านั้น</div>
  return (
    <>
      <ProposalsListView
        proposals={proposals}
        loading={loading}
        error={error}
        period={period}
        onPeriodChange={setPeriod}
        minOverdueDays={minOverdueDays}
        onMinOverdueDaysChange={setMinOverdueDays}
        thresholdDays={thresholdDays}
        onThresholdDaysChange={setThresholdDays}
        onPreview={setPreview}
        onMarkReviewed={(id) => setReviewed((prev) => new Set([...prev, id]))}
        reviewedIds={reviewed}
      />
      {preview ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded p-4 w-[600px] space-y-3">
            <div className="text-lg font-semibold">Proposal Preview</div>
            <div>Type: {preview.type}</div>
            <div>Target: {preview.targetId}</div>
            <div>Severity: {preview.severity}</div>
            <div>Reason: {preview.reason}</div>
            <div>Generated: {new Date(preview.generatedAt).toLocaleString()}</div>
            <div className="flex justify-end">
              <button className="px-3 py-1 rounded bg-slate-800 text-white" onClick={() => setPreview(null)}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
