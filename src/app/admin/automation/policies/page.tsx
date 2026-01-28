'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type Role = 'ADMIN' | 'STAFF' | null

type PolicyRow = {
  id: string
  proposalType: 'REMIND_INVOICE' | 'ESCALATE_TICKET'
  maxSeverity: 'LOW' | 'MEDIUM'
  autoApprove: boolean
  autoExecute: boolean
  dailyLimit: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

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

export default function AutomationPoliciesPage() {
  const [role, setRole] = useState<Role>(null)
  const [items, setItems] = useState<PolicyRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canView = useMemo(() => role === 'ADMIN', [role])
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sess = await fetchAny<{ userId: string | null; role: Role }>('/api/auth/session')
      setRole(sess?.role ?? null)
      const data = await fetchAny<{ items: PolicyRow[] }>('/api/admin/automation/policies')
      setItems(Array.isArray(data.items) ? data.items : [])
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
  async function toggle(id: string, enabled: boolean) {
    const ok = window.confirm(`ต้องการ${enabled ? 'เปิด' : 'ปิด'} Policy นี้หรือไม่?`)
    if (!ok) return
    try {
      await fetch(`/api/admin/automation/policies/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', accept: 'application/vnd.apartment.v1.1+json' },
        body: JSON.stringify({ enabled }),
      })
      await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    }
  }
  if (!canView) return <div className="p-4 text-red-600">ต้องเป็น Admin เท่านั้น</div>
  return (
    <div className="p-4 space-y-4">
      <h2 className="font-semibold text-lg">Automation Policies</h2>
      {error ? <div className="text-red-600">{error}</div> : null}
      {loading ? <div>กำลังโหลด...</div> : null}
      {items.length === 0 && !loading ? <div>ไม่มี Policy</div> : null}
      {items.length > 0 ? (
        <table className="w-full border border-slate-300">
          <thead className="bg-slate-100">
            <tr>
              <th className="text-left p-2 border-b">Type</th>
              <th className="text-left p-2 border-b">Max Severity</th>
              <th className="text-left p-2 border-b">Auto Approve</th>
              <th className="text-left p-2 border-b">Auto Execute</th>
              <th className="text-left p-2 border-b">Daily Limit</th>
              <th className="text-left p-2 border-b">Enabled</th>
              <th className="text-left p-2 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b">
                <td className="p-2">{it.proposalType}</td>
                <td className="p-2">{it.maxSeverity}</td>
                <td className="p-2">{it.autoApprove ? 'Yes' : 'No'}</td>
                <td className="p-2">{it.autoExecute ? 'Yes' : 'No'}</td>
                <td className="p-2">{it.dailyLimit}</td>
                <td className="p-2">{it.enabled ? 'Enabled' : 'Disabled'}</td>
                <td className="p-2">
                  <button className="px-3 py-1 rounded bg-slate-700 text-white" onClick={() => toggle(it.id, !it.enabled)}>
                    Toggle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  )
}
