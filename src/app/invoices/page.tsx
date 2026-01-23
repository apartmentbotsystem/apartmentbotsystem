'use client'

import { useCallback, useEffect, useState } from "react"

type Invoice = { id: string; roomId: string; tenantId: string; month: string; amount: number; status?: string }

export default function InvoicesPage() {
  const [items, setItems] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roomId, setRoomId] = useState("")
  const [tenantId, setTenantId] = useState("")
  const [amount, setAmount] = useState<number>(0)
  const [month, setMonth] = useState<string>(new Date().toISOString().slice(0, 7))
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
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
      const data = await fetchEnvelope("/api/invoices")
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

  async function createInvoice() {
    setCreating(true)
    setCreateError(null)
    try {
      const data = await fetchEnvelope("/api/invoices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId, tenantId, amount: Number(amount), month }),
      })
      setItems((prev) => [data, ...prev])
      setRoomId("")
      setTenantId("")
      setAmount(0)
      setMonth(new Date().toISOString().slice(0, 7))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setCreateError(msg)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          createInvoice()
        }}
      >
        <div className="flex flex-col">
          <label className="text-sm">Room ID</label>
          <input autoFocus value={roomId} onChange={(e) => setRoomId(e.target.value)} className="border rounded px-2 py-1" />
        </div>
        <div className="flex flex-col">
          <label className="text-sm">Tenant ID</label>
          <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="border rounded px-2 py-1" />
        </div>
        <div className="flex flex-col">
          <label className="text-sm">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="border rounded px-2 py-1"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-sm">Month</label>
          <input value={month} onChange={(e) => setMonth(e.target.value)} className="border rounded px-2 py-1" />
        </div>
        <button type="submit" disabled={creating || role !== "ADMIN"} className="rounded bg-slate-800 px-3 py-2 text-white disabled:opacity-50">
          Create Invoice
        </button>
      </form>
      {createError && <div className="text-red-600">Error: {createError}</div>}
      <div className="border rounded p-4 bg-white">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Invoices</h2>
          <button onClick={load} className="rounded bg-slate-200 px-3 py-1">
            Reload
          </button>
        </div>
        {loading && <div>Loading...</div>}
        {!loading && error && <div className="text-red-600">Error: {error}</div>}
        {!loading && !error && items.length === 0 && <div className="text-slate-500">ไม่มีข้อมูล</div>}
        {!loading && !error && items.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th>Invoice</th>
                <th>Room</th>
                <th>Tenant</th>
                <th>Month</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t">
                  <td>{r.id}</td>
                  <td>{r.roomId}</td>
                  <td>{r.tenantId}</td>
                  <td>{r.month}</td>
                  <td>{r.amount}</td>
                  <td>{r.status || "UNPAID"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
