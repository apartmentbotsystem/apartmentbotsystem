'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { z } from 'zod'
import { AutomationApprovalsListDTO, AutomationApprovalDTO, AutomationProposalDTO } from '@/interface/validators/report.schema'

type Role = 'ADMIN' | 'STAFF' | null
type Approval = z.infer<typeof AutomationApprovalDTO>

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

export default function AutomationApprovalsPage() {
  const [role, setRole] = useState<Role>(null)
  const [items, setItems] = useState<Approval[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dryRun, setDryRun] = useState(true)
  const [results, setResults] = useState<Record<string, { status: "EXECUTED" | "SKIPPED" | "FAILED"; reason?: string; targetType?: string; targetId?: string; severity?: string; currentState?: Record<string, unknown> }>>({})
  const [timelines, setTimelines] = useState<Record<string, { timeline: Array<{ type: string; timestamp: string; actorId: string; dryRun: boolean; payload: unknown }>; audits: Array<{ id: string; action: string; actorId: string; dryRun: boolean; result: unknown; createdAt: string }> }>>({})
  const [openRow, setOpenRow] = useState<string | null>(null)
  const canView = useMemo(() => role === 'ADMIN', [role])
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sess = await fetchAny<{ userId: string | null; role: Role }>('/api/auth/session')
      setRole(sess?.role ?? null)
      const data = await fetchAny<{ items: Approval[] }>('/api/admin/automation/approvals')
      const parsed = AutomationApprovalsListDTO.parse(data)
      setItems(Array.isArray(parsed.items) ? parsed.items : [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])
  async function preview(id: string) {
    try {
      const res = await fetch(`/api/admin/automation/approvals/${encodeURIComponent(id)}/preview`, {
        method: 'GET',
        headers: { accept: 'application/vnd.apartment.v1.1+json' },
        cache: 'no-store',
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || 'Error')
      setResults((prev) => ({ ...prev, [id]: json.data }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    }
  }
  async function loadTimeline(id: string) {
    try {
      const res = await fetch(`/api/admin/automation/approvals/${encodeURIComponent(id)}/timeline`, {
        method: 'GET',
        headers: { accept: 'application/vnd.apartment.v1.1+json' },
        cache: 'no-store',
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || 'Error')
      setTimelines((prev) => ({ ...prev, [id]: { timeline: json.data.timeline, audits: json.data.audits } }))
      setOpenRow(id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    }
  }
  function exportJSON(id: string) {
    const t = timelines[id]
    if (!t) return
    const blob = new Blob([JSON.stringify(t.audits, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `automation-audits-${id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  function exportCSV(id: string) {
    const t = timelines[id]
    if (!t) return
    const headers = ['id', 'action', 'actorId', 'dryRun', 'createdAt']
    const rows = t.audits.map((a) => [a.id, a.action, a.actorId, String(a.dryRun), a.createdAt])
    const csv = [headers.join(','), ...rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `automation-audits-${id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  async function execute(id: string, severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") {
    if (!dryRun) {
      if (severity === 'CRITICAL') {
        const typed = window.prompt('พิมพ์คำว่า EXECUTE CRITICAL เพื่อยืนยันการรันระดับ CRITICAL')
        if (typed !== 'EXECUTE CRITICAL') return
      } else if (severity === 'HIGH') {
        const typed = window.prompt('พิมพ์คำว่า EXECUTE เพื่อยืนยันการรัน')
        if (typed !== 'EXECUTE') return
      } else if (severity === 'MEDIUM') {
        const ok = window.confirm('ยืนยันการรัน Automation ระดับ MEDIUM')
        if (!ok) return
      }
    }
    try {
      const res = await fetch('/api/admin/automation/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/vnd.apartment.v1.1+json' },
        body: JSON.stringify({ approvalId: id, dryRun }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || 'Error')
      setResults((prev) => ({ ...prev, [id]: json.data }))
      await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    }
  }
  if (!canView) return <div className="p-4 text-red-600">ต้องเป็น Admin เท่านั้น</div>
  return (
    <div className="p-4 space-y-4">
      <h2 className="font-semibold text-lg">Automation Approvals</h2>
      <div className="flex items-center gap-3">
        <label className="text-sm">Dry Run</label>
        <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
        <span className="text-slate-500 text-sm">{dryRun ? 'ไม่เขียน DB/Audit ใดๆ' : 'ดำเนินการจริง (บันทึก Audit)'}</span>
      </div>
      {error ? <div className="text-red-600">{error}</div> : null}
      {loading ? <div>กำลังโหลด...</div> : null}
      {items.length === 0 && !loading ? <div>ไม่มีรายการอนุมัติ</div> : null}
      {items.length > 0 ? (
        <table className="w-full border border-slate-300">
          <thead className="bg-slate-100">
            <tr>
              <th className="text-left p-2 border-b">Decision</th>
              <th className="text-left p-2 border-b">Proposal</th>
              <th className="text-left p-2 border-b">Decided By</th>
              <th className="text-left p-2 border-b">Decided At</th>
              <th className="text-left p-2 border-b">Executed</th>
              <th className="text-left p-2 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const p = AutomationProposalDTO.safeParse(it.proposalSnapshot)
              const snap = p.success ? p.data : null
              const canExec = it.decision === 'APPROVED' && !it.executedAt
              const r = results[it.id]
              const badge =
                r?.status === 'EXECUTED'
                  ? 'bg-green-600 text-white'
                  : r?.status === 'SKIPPED'
                  ? 'bg-yellow-600 text-white'
                  : r?.status === 'FAILED'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-200 text-slate-700'
              return (
                <tr key={it.id} className="border-b">
                  <td className="p-2">{it.decision}</td>
                  <td className="p-2">
                    <div>Type: {snap?.type ?? '-'}</div>
                    <div>Target: {snap?.targetId ?? '-'}</div>
                    <div className="text-slate-600 text-sm">Reason: {snap?.reason ?? '-'}</div>
                    <div className="mt-1 text-xs">
                      <span className="px-2 py-1 rounded bg-slate-100">Severity: {snap ? snap.severity : '-'}</span>
                    </div>
                  </td>
                  <td className="p-2">{it.decidedBy}</td>
                  <td className="p-2">{new Date(it.decidedAt).toLocaleString()}</td>
                  <td className="p-2">{it.executedAt ? new Date(it.executedAt).toLocaleString() : '-'}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <button
                        className="px-3 py-1 rounded bg-slate-700 text-white"
                        onClick={() => preview(it.id)}
                      >
                        👀 Preview
                      </button>
                      <button
                      disabled={!canExec}
                      className={`px-3 py-1 rounded ${canExec ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-600'}`}
                      onClick={() => execute(it.id, snap ? snap.severity : 'LOW')}
                    >
                      🚀 Execute
                    </button>
                      <button
                        className="px-3 py-1 rounded bg-slate-600 text-white"
                        onClick={() => loadTimeline(it.id)}
                      >
                        🕒 Timeline
                      </button>
                    </div>
                    {r ? (
                      <div className="mt-2 space-y-1">
                        <span className={`inline-block px-2 py-1 rounded text-xs ${badge}`}>{r.status}</span>
                        <details className="mt-1">
                          <summary className="cursor-pointer text-sm text-slate-700">รายละเอียดผลลัพธ์</summary>
                          <pre className="mt-1 text-xs bg-slate-50 p-2 rounded overflow-auto">{JSON.stringify(r, null, 2)}</pre>
                        </details>
                      </div>
                    ) : null}
                    {openRow === it.id && timelines[it.id] ? (
                      <div className="mt-3 border-t pt-2">
                        <div className="flex items-center gap-2 mb-2">
                          <button className="px-3 py-1 rounded bg-slate-500 text-white" onClick={() => exportJSON(it.id)}>
                            📤 Export JSON
                          </button>
                          <button className="px-3 py-1 rounded bg-slate-500 text-white" onClick={() => exportCSV(it.id)}>
                            📄 Export CSV
                          </button>
                        </div>
                        <div className="space-y-2">
                          {timelines[it.id].timeline.map((ev, idx) => {
                            const b =
                              ev.type === 'EXECUTE' || ev.type === 'AUTO_EXECUTED'
                                ? 'bg-green-600 text-white'
                                : ev.type === 'SKIP'
                                ? 'bg-yellow-600 text-white'
                                : ev.type === 'FAIL'
                                ? 'bg-red-600 text-white'
                                : 'bg-slate-300 text-slate-800'
                            return (
                              <div key={idx} className="p-2 border rounded">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-1 rounded text-xs ${b}`}>{ev.type}</span>
                                  <span className="text-xs text-slate-600">{new Date(ev.timestamp).toLocaleString()}</span>
                                  <span className="text-xs text-slate-600">actor: {ev.actorId}</span>
                                  <span className="text-xs text-slate-600">{ev.dryRun ? 'dry-run' : 'real'}</span>
                                </div>
                                <details className="mt-1">
                                  <summary className="cursor-pointer text-sm text-slate-700">รายละเอียด</summary>
                                  <pre className="mt-1 text-xs bg-slate-50 p-2 rounded overflow-auto">{JSON.stringify(ev.payload, null, 2)}</pre>
                                </details>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
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
