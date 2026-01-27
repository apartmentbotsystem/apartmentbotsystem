'use client'

import { useCallback, useEffect, useState } from "react"

type InvoiceItem = {
  id: string
  tenant: { id: string; name: string }
  room: { id: string; roomNumber: string }
  period: string
  rent: number
  total: number
  status: string
  isOverdue?: boolean
  dueDate?: string
}

export default function BillingPage() {
  const [period, setPeriod] = useState<string>(new Date().toISOString().slice(0, 7))
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<"ADMIN" | "STAFF" | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [confirmNote, setConfirmNote] = useState<string>("")
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [remindingId, setRemindingId] = useState<string | null>(null)
  const [remindError, setRemindError] = useState<string | null>(null)
  const [remindSending, setRemindSending] = useState(false)
  const [lastRemindedAt, setLastRemindedAt] = useState<Record<string, string | null>>({})
  const [cooldownHoursLeft, setCooldownHoursLeft] = useState<Record<string, number>>({})

  async function fetchEnvelope<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { ...init, headers: { ...(init?.headers || {}), accept: "application/vnd.apartment.v1.1+json" } })
    const json = await res.json()
    if (json.success) return json.data as T
    throw new Error(json.error?.message || "Error")
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sess = await fetchEnvelope<{ userId: string | null; role: "ADMIN" | "STAFF" | null }>("/api/auth/session")
      setRole(sess?.role ?? null)
      const rows = await fetchEnvelope<InvoiceItem[]>(`/api/admin/invoices?period=${encodeURIComponent(period)}`)
      setItems(Array.isArray(rows) ? rows : [])
      const overdueIds = rows.filter((r) => r.status === "SENT" && r.isOverdue).map((r) => r.id)
      const entries = await Promise.all(
        overdueIds.map(async (id) => {
          try {
            const res = await fetchEnvelope<{ items: Array<{ id: string; sentAt: string }> }>(`/api/admin/invoices/${encodeURIComponent(id)}/reminders`)
            const last = res.items[0]?.sentAt ?? null
            return { id, last }
          } catch {
            return { id, last: null }
          }
        }),
      )
      const map: Record<string, string | null> = {}
      const cool: Record<string, number> = {}
      for (const e of entries) {
        map[e.id] = e.last
        if (e.last) {
          const last = new Date(e.last)
          const now = new Date()
          const diffMs = now.getTime() - last.getTime()
          const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000
          if (diffMs < TWENTY_FOUR_HOURS) {
            cool[e.id] = Math.max(1, Math.ceil((TWENTY_FOUR_HOURS - diffMs) / (60 * 60 * 1000)))
          } else {
            cool[e.id] = 0
          }
        } else {
          cool[e.id] = 0
        }
      }
      setLastRemindedAt(map)
      setCooldownHoursLeft(cool)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    load()
  }, [load])

  async function confirmPayment(id: string) {
    if (role !== "ADMIN") return
    setConfirmError(null)
    try {
      await fetchEnvelope(`/api/admin/invoices/${encodeURIComponent(id)}/confirm-payment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentNote: confirmNote || undefined }),
      })
      setConfirmingId(null)
      setConfirmNote("")
      await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setConfirmError(msg)
    }
  }

  async function generate() {
    if (role !== "ADMIN") return
    setGenerating(true)
    setGenerateError(null)
    try {
      await fetchEnvelope(`/api/admin/billing/generate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ period }) })
      await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setGenerateError(msg)
    } finally {
      setGenerating(false)
    }
  }

  async function sendReminder(id: string) {
    if (role !== "ADMIN") return
    setRemindError(null)
    setRemindSending(true)
    try {
      await fetchEnvelope(`/api/admin/invoices/${encodeURIComponent(id)}/remind`, { method: "POST" })
      setRemindingId(null)
      alert("ส่งแจ้งเตือนแล้ว")
      await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setRemindError(msg)
    } finally {
      setRemindSending(false)
    }
  }

  return (
    <div className="space-y-6 p-4">
      <h2 className="font-semibold text-lg">Billing</h2>
      <div className="flex items-center space-x-2">
        <label className="text-sm">Period</label>
        <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="border rounded px-2 py-1" />
        <button onClick={load} className="rounded bg-slate-200 px-3 py-1">
          Load
        </button>
        <button onClick={generate} disabled={role !== "ADMIN" || generating} className="rounded bg-slate-800 px-3 py-1 text-white disabled:opacity-50">
          Generate Draft
        </button>
      </div>
      {generateError && <div className="text-red-600">{generateError}</div>}
      {error && <div className="text-red-600">{error}</div>}
      <div className="border rounded bg-white">
        {loading ? (
          <div className="p-4">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">Room</th>
                <th className="p-2">Tenant</th>
                <th className="p-2">Rent</th>
                <th className="p-2">Total</th>
                <th className="p-2">Due Date</th>
                <th className="p-2">Status</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t">
                  <td className="p-2">{it.room.roomNumber}</td>
                  <td className="p-2">{it.tenant.name}</td>
                  <td className="p-2">{it.rent}</td>
                  <td className="p-2">{it.total}</td>
                  <td className="p-2">{it.dueDate ? new Date(it.dueDate).toISOString().slice(0, 10) : "-"}</td>
                  <td className="p-2">
                    {it.status === "PAID" ? (
                      <span className="rounded bg-green-600 px-2 py-1 text-white">PAID</span>
                    ) : it.status === "SENT" && it.isOverdue ? (
                      <span className="rounded bg-red-600 px-2 py-1 text-white">OVERDUE</span>
                    ) : it.status === "SENT" ? (
                      <span className="rounded bg-yellow-500 px-2 py-1 text-white">SENT</span>
                    ) : (
                      <span className="rounded bg-slate-400 px-2 py-1 text-white">{it.status}</span>
                    )}
                  </td>
                  <td className="p-2">
                    <button
                      onClick={async () => {
                        try {
                          await fetchEnvelope(`/api/admin/invoices/${encodeURIComponent(it.id)}/send`, { method: "POST" })
                          await load()
                        } catch (e) {
                          const msg = e instanceof Error ? e.message : String(e)
                          alert(msg)
                        }
                      }}
                      disabled={role !== "ADMIN" || it.status !== "DRAFT"}
                      className="rounded bg-green-700 px-3 py-1 text-white disabled:opacity-50"
                    >
                      Send
                    </button>
                    <button
                      onClick={() => {
                        setConfirmingId(it.id)
                        setConfirmNote("")
                        setConfirmError(null)
                      }}
                      disabled={role !== "ADMIN" || it.status !== "SENT"}
                      className="rounded bg-blue-700 px-3 py-1 text-white disabled:opacity-50"
                    >
                      Confirm Payment
                    </button>
                    <button
                      onClick={() => {
                        setRemindingId(it.id)
                        setRemindError(null)
                      }}
                      disabled={
                        role !== "ADMIN" || it.status !== "SENT" || !it.isOverdue || (cooldownHoursLeft[it.id ?? ""] ?? 0) > 0
                      }
                      className="rounded bg-red-700 px-3 py-1 text-white disabled:opacity-50"
                    >
                      {cooldownHoursLeft[it.id ?? ""] ? `Remind (available in ${cooldownHoursLeft[it.id]}h)` : "Remind"}
                    </button>
                    {lastRemindedAt[it.id] && (
                      <div className="text-xs text-gray-600 mt-1">Last reminded: {new Date(lastRemindedAt[it.id]!).toLocaleString()}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {confirmingId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded shadow-md w-full max-w-md">
            <div className="border-b p-3 font-semibold">Confirm Payment</div>
            <div className="p-3 space-y-2">
              <label className="text-sm">Payment Note (optional)</label>
              <textarea
                value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)}
                className="w-full border rounded p-2"
                rows={4}
                placeholder="รายละเอียดจากสลิป หรือหมายเหตุ"
              />
              {confirmError && <div className="text-red-600">{confirmError}</div>}
            </div>
            <div className="border-t p-3 flex justify-end gap-2">
              <button onClick={() => setConfirmingId(null)} className="rounded bg-slate-200 px-3 py-1">
                Cancel
              </button>
              <button
                onClick={() => confirmPayment(confirmingId)}
                className="rounded bg-blue-700 px-3 py-1 text-white"
                disabled={role !== "ADMIN"}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      {remindingId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded shadow-md w-full max-w-md">
            <div className="border-b p-3 font-semibold">Send Overdue Reminder</div>
            <div className="p-3 space-y-2">
              <div className="text-sm">ยืนยันส่งแจ้งเตือนบิลค้างชำระไปยังผู้เช่า</div>
              {remindError && <div className="text-red-600">{remindError}</div>}
            </div>
            <div className="border-t p-3 flex justify-end gap-2">
              <button onClick={() => setRemindingId(null)} className="rounded bg-slate-200 px-3 py-1" disabled={remindSending}>
                Cancel
              </button>
              <button onClick={() => sendReminder(remindingId)} className="rounded bg-red-700 px-3 py-1 text-white" disabled={role !== "ADMIN" || remindSending}>
                {remindSending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
