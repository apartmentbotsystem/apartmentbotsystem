'use client'

import { useCallback, useEffect, useState } from "react"

type Activity = { id: string; createdAt: string; action: string; entityType: string; entityId: string }

export default function ActivityPage() {
  const [items, setItems] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [before, setBefore] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  async function fetchEnvelope(url: string, init?: RequestInit) {
    const res = await fetch(url, {
      ...init,
      headers: { ...(init?.headers || {}), accept: "application/vnd.apartment.v1.1+json" },
    })
    const json = await res.json()
    if (json.success) return json.data
    throw new Error(json.error?.message || "Error")
  }

  const load = useCallback(async (initial = false) => {
    if (initial) {
      setLoading(true)
      setError(null)
    }
    try {
      const qs = before ? `?limit=50&before=${encodeURIComponent(before)}` : "?limit=50"
      const data = await fetchEnvelope(`/api/activity${qs}`)
      const list = Array.isArray(data) ? data : []
      setItems((prev) => (initial ? list : [...prev, ...list]))
      if (list.length > 0) setBefore(list[list.length - 1].createdAt)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    } finally {
      if (initial) setLoading(false)
    }
  }, [before])

  useEffect(() => {
    load(true)
  }, [load])

  async function loadMore() {
    setLoadingMore(true)
    await load(false).finally(() => setLoadingMore(false))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Activity Log</h2>
        <button onClick={() => load(true)} className="rounded bg-slate-200 px-3 py-1">
          Reload
        </button>
      </div>
      <div className="border rounded p-4 bg-white">
        {loading && <div>Loading...</div>}
        {!loading && error && <div className="text-red-600">Error: {error}</div>}
        {!loading && !error && items.length === 0 && <div className="text-slate-500">ไม่มีข้อมูล</div>}
        {!loading && !error && items.length > 0 && (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th>Time</th>
                  <th>Action</th>
                  <th>Entity</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td>{a.createdAt}</td>
                    <td>{a.action}</td>
                    <td>
                      {a.entityType}:{a.entityId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded bg-slate-800 px-3 py-1 text-white disabled:opacity-50"
              >
                Load More
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
