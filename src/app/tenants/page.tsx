'use client'

import { useCallback, useEffect, useState } from "react"

type Tenant = { id: string; name: string; phone: string | null; role: string; roomId: string; pending?: boolean }

export default function TenantsPage() {
  const [items, setItems] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [approving, setApproving] = useState<string | null>(null)
  const [approveError, setApproveError] = useState<string | null>(null)
  const [role, setRole] = useState<"ADMIN" | "STAFF" | null>(null)

  async function fetchEnvelope(url: string, init?: RequestInit) {
    const res = await fetch(url, {
      ...init,
      headers: { ...(init?.headers || {}), accept: "application/vnd.apartment.v1.1+json" },
    })
    const json = await res.json()
    if (json.success) return json.data
    throw new Error(json.error?.message || "Error")
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sess = await fetchEnvelope("/api/auth/session")
      setRole(sess?.role ?? null)
      const data = await fetchEnvelope("/api/tenants")
      setItems(Array.isArray(data) ? data : [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function approve(id: string) {
    setApproving(id)
    setApproveError(null)
    try {
      const data = await fetchEnvelope(`/api/tenants/${id}/approve`, { method: "POST" })
      setItems((prev) => prev.map((t) => (t.id === id ? data : t)))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setApproveError(msg)
    } finally {
      setApproving(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Tenants</h2>
        <button onClick={load} className="rounded bg-slate-200 px-3 py-1">
          Reload
        </button>
      </div>
      {approveError && <div className="text-red-600">Error: {approveError}</div>}
      <div className="border rounded p-4 bg-white">
        {loading && <div>Loading...</div>}
        {!loading && error && <div className="text-red-600">Error: {error}</div>}
        {!loading && !error && items.length === 0 && <div className="text-slate-500">ไม่มีข้อมูล</div>}
        {!loading && !error && items.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th>Tenant</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Room</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-t">
                  <td>{t.name}</td>
                  <td>{t.phone ?? "-"}</td>
                  <td>{t.role}</td>
                  <td>{t.roomId}</td>
                  <td>
                    <button
                      onClick={() => approve(t.id)}
                      disabled={approving === t.id || role !== "ADMIN"}
                      className="rounded bg-slate-800 px-3 py-1 text-white disabled:opacity-50"
                    >
                      Approve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
