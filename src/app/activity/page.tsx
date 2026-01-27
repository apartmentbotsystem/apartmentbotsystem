'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type Role = 'ADMIN' | 'STAFF' | null
type AuditItem = {
  id: string
  action: string
  adminId: string
  tenantRegistrationId: string
  tenantId: string | null
  lineUserId: string | null
  createdAt: string
}

async function fetchAny<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.headers || {}), accept: 'application/vnd.apartment.v1.1+json' },
    cache: 'no-store',
  })
  const json = await res.json().catch(() => null)
  if (json && typeof json === 'object' && 'success' in json) {
    if (json.success) return json.data as T
    const message = (json.error && json.error.message) || 'Error'
    throw new Error(String(message))
  }
  return json as T
}

export default function ActivityPage() {
  const [role, setRole] = useState<Role>(null)
  const [items, setItems] = useState<AuditItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canView = useMemo(() => role === 'ADMIN', [role])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sess = await fetchAny<{ userId: string | null; role: 'ADMIN' | 'STAFF' | null }>('/api/auth/session')
      setRole(sess?.role ?? null)
      const data = await fetchAny<AuditItem[]>('/api/admin/audit-logs?limit=50')
      setItems(Array.isArray(data) ? data : [])
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

  if (!canView) {
    return <div className="p-4 text-red-600">ต้องเป็น Admin เท่านั้น</div>
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="font-semibold text-lg">Activity Feed</h2>
      {error ? <div className="text-red-600">{error}</div> : null}
      {loading ? <div>กำลังโหลด...</div> : null}
      {items.length === 0 && !loading ? <div>ไม่มีข้อมูล</div> : null}
      <table className="w-full border border-slate-300">
        <thead className="bg-slate-100">
          <tr>
            <th className="text-left p-2 border-b">เวลา</th>
            <th className="text-left p-2 border-b">แอดมิน</th>
            <th className="text-left p-2 border-b">Action</th>
            <th className="text-left p-2 border-b">LINE User ID</th>
            <th className="text-left p-2 border-b">Tenant/Room</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-b">
              <td className="p-2">{new Date(it.createdAt).toLocaleString()}</td>
              <td className="p-2">{it.adminId}</td>
              <td className="p-2">{it.action === 'TENANT_REGISTRATION_APPROVE' ? 'Approve' : it.action === 'TENANT_REGISTRATION_REJECT' ? 'Reject' : it.action}</td>
              <td className="p-2">{it.lineUserId || '-'}</td>
              <td className="p-2">{it.tenantId || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
