'use client'

import { useCallback, useEffect, useState } from "react"

type Payment = { id: string; invoiceId: string; method: string; reference: string | null; paidAt: string }

export default function PaymentsPage() {
  const [items, setItems] = useState<Payment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invoiceId, setInvoiceId] = useState("")
  const [method, setMethod] = useState("CASH")
  const [reference, setReference] = useState<string | null>("")
  const [recording, setRecording] = useState(false)
  const [recordError, setRecordError] = useState<string | null>(null)

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
      const data = await fetchEnvelope("/api/payments")
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

  async function recordPayment() {
    setRecording(true)
    setRecordError(null)
    try {
      const data = await fetchEnvelope("/api/payments/record", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invoiceId, method, reference }),
      })
      setItems((prev) => [data, ...prev])
      setInvoiceId("")
      setMethod("CASH")
      setReference("")
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setRecordError(msg)
    } finally {
      setRecording(false)
    }
  }

  return (
    <div className="space-y-6">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          recordPayment()
        }}
      >
        <div className="flex flex-col">
          <label className="text-sm">Invoice ID</label>
          <input
            autoFocus
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-sm">Method</label>
          <input value={method} onChange={(e) => setMethod(e.target.value)} className="border rounded px-2 py-1" />
        </div>
        <div className="flex flex-col">
          <label className="text-sm">Reference</label>
          <input
            value={reference ?? ""}
            onChange={(e) => setReference(e.target.value || null)}
            className="border rounded px-2 py-1"
          />
        </div>
        <button type="submit" disabled={recording} className="rounded bg-slate-800 px-3 py-2 text-white disabled:opacity-50">
          Record Payment
        </button>
      </form>
      {recordError && <div className="text-red-600">Error: {recordError}</div>}
      <div className="border rounded p-4 bg-white">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Recent Payments</h2>
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
                <th>Payment</th>
                <th>Invoice</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Paid At</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t">
                  <td>{r.id}</td>
                  <td>{r.invoiceId}</td>
                  <td>{r.method}</td>
                  <td>{r.reference ?? "-"}</td>
                  <td>{r.paidAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
