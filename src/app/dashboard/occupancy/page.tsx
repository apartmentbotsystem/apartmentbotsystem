'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AdminMonthlyOccupancyItemDTO } from '@/application/dto/admin-occupancy-monthly.dto'

type Role = 'ADMIN' | 'STAFF' | null

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

function formatDate(d: string | null): string {
  if (!d) return '-'
  try {
    const iso = new Date(d).toISOString()
    return iso.slice(0, 10)
  } catch {
    return d
  }
}

function getCurrentMonth(): string {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export default function AdminOccupancyDashboardPage() {
  const [role, setRole] = useState<Role>(null)
  const [month, setMonth] = useState<string>(getCurrentMonth())
  const [items, setItems] = useState<AdminMonthlyOccupancyItemDTO[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canView = useMemo(() => role === 'ADMIN', [role])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sess = await fetchAny<{ userId: string | null; role: 'ADMIN' | 'STAFF' | null }>('/api/auth/session')
      setRole(sess?.role ?? null)
      const data = await fetchAny<AdminMonthlyOccupancyItemDTO[]>(
        `/api/admin/dashboard/occupancy-monthly?month=${encodeURIComponent(month)}`,
      )
      setItems(Array.isArray(data) ? data : [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Admin Occupancy Dashboard</h2>
        <div className="flex items-center gap-3">
          <label className="text-sm">Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border rounded px-2 py-1"
          />
          <button onClick={load} className="rounded bg-slate-200 px-3 py-1">
            Reload
          </button>
        </div>
      </div>
      {!canView && <div className="text-red-600">Forbidden: ADMIN only</div>}
      {canView && (
        <div className="border rounded p-4 bg-white">
          {loading && <div>Loading...</div>}
          {!loading && error && <div className="text-red-600">Error: {error}</div>}
          {!loading && !error && items.length === 0 && <div className="text-slate-500">ไม่มีข้อมูล</div>}
          {!loading && !error && items.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th>Room</th>
                  <th>Total Occupied Days</th>
                  <th>Occupancy Rate</th>
                  <th>First Occupied At</th>
                  <th>Last Vacated At</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={`${it.roomId}-${month}`} className="border-t">
                    <td>{it.roomId}</td>
                    <td>{it.totalOccupiedDays}</td>
                    <td>{Math.round(it.occupancyRate)}</td>
                    <td>{formatDate(it.firstOccupiedAt)}</td>
                    <td>{formatDate(it.lastVacatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
