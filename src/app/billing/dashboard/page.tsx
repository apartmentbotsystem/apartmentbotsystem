'use client'

import { useEffect, useMemo, useState } from "react"

type DashboardResponse = {
  month: string
  kpis: { billed: number; collected: number; outstanding: number; collectionRate: number }
  aging: { "0_7": number; "8_30": number; "31_60": number; "60_plus": number }
}

type TrendItem = { month: string; billed: number; collected: number; collectionRate: number }

async function fetchEnvelope<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...(init?.headers || {}), accept: "application/vnd.apartment.v1.1+json" } })
  const json = await res.json()
  if (json.success) return json.data as T
  throw new Error(json.error?.message || "Error")
}

function formatCurrency(n: number): string {
  return `฿${(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
}

function formatPercent(n: number): string {
  return `${Math.round((n || 0) * 100) / 100}%`
}

export default function BillingDashboardPage() {
  const [month, setMonth] = useState<string>(new Date().toISOString().slice(0, 7))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [trend, setTrend] = useState<TrendItem[]>([])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const d = await fetchEnvelope<DashboardResponse>(`/api/admin/billing/dashboard?month=${encodeURIComponent(month)}`)
      setData(d)
      const t = await fetchEnvelope<{ items: TrendItem[] }>(`/api/admin/billing/trend`)
      setTrend(Array.isArray(t.items) ? t.items : [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setData(null)
      setTrend([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [month])

  const maxBilled = useMemo(() => Math.max(1, ...trend.map((it) => it.billed)), [trend])

  return (
    <div className="space-y-6 p-4">
      <h2 className="font-semibold text-lg">Billing Dashboard</h2>
      <div className="flex items-center gap-2">
        <label className="text-sm">Month</label>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="border rounded px-2 py-1" />
        <button onClick={load} className="rounded bg-slate-200 px-3 py-1">
          Reload
        </button>
      </div>
      {error && <div className="text-red-600">{error}</div>}
      {loading ? (
        <div className="p-4">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded border bg-white p-4">
              <div className="text-xs text-gray-500">Total Billed</div>
              <div className="text-xl font-semibold">{formatCurrency(data?.kpis.billed || 0)}</div>
            </div>
            <div className="rounded border bg-white p-4">
              <div className="text-xs text-gray-500">Total Collected</div>
              <div className="text-xl font-semibold">{formatCurrency(data?.kpis.collected || 0)}</div>
            </div>
            <div className="rounded border bg-white p-4">
              <div className="text-xs text-gray-500">Outstanding</div>
              <div className="text-xl font-semibold">{formatCurrency(data?.kpis.outstanding || 0)}</div>
            </div>
            <div className="rounded border bg-white p-4">
              <div className="text-xs text-gray-500">Collection Rate</div>
              <div className="text-xl font-semibold">{formatPercent(data?.kpis.collectionRate || 0)}</div>
            </div>
          </div>

          <div className="rounded border bg-white">
            <div className="p-3 font-semibold">Aging (Outstanding)</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="p-2">0–7 วัน</th>
                  <th className="p-2">8–30 วัน</th>
                  <th className="p-2">31–60 วัน</th>
                  <th className="p-2">60+ วัน</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="p-2">{formatCurrency(data?.aging["0_7"] || 0)}</td>
                  <td className="p-2">{formatCurrency(data?.aging["8_30"] || 0)}</td>
                  <td className="p-2">{formatCurrency(data?.aging["31_60"] || 0)}</td>
                  <td className="p-2">{formatCurrency(data?.aging["60_plus"] || 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded border bg-white p-4">
            <div className="mb-2 font-semibold">Trend (6 Months)</div>
            <div className="text-xs text-gray-500 mb-2">บรรทัดบน = billed, บรรทัดล่าง = collected</div>
            <svg width="100%" height="200" viewBox={`0 0 ${Math.max(300, trend.length * 60)} 200`} preserveAspectRatio="none">
              {trend.length > 0 && (
                <>
                  {trend.map((it, idx) => {
                    const x = 20 + idx * 50
                    const yBilled = 180 - (it.billed / maxBilled) * 150
                    const yCollected = 180 - (it.collected / maxBilled) * 150
                    return (
                      <g key={it.month}>
                        <circle cx={x} cy={yBilled} r={3} fill="#2563eb" />
                        <circle cx={x} cy={yCollected} r={3} fill="#16a34a" />
                        <text x={x} y={195} textAnchor="middle" fontSize="10" fill="#374151">
                          {it.month}
                        </text>
                      </g>
                    )
                  })}
                  <polyline
                    points={trend.map((it, idx) => {
                      const x = 20 + idx * 50
                      const y = 180 - (it.billed / maxBilled) * 150
                      return `${x},${y}`
                    }).join(" ")}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2"
                  />
                  <polyline
                    points={trend.map((it, idx) => {
                      const x = 20 + idx * 50
                      const y = 180 - (it.collected / maxBilled) * 150
                      return `${x},${y}`
                    }).join(" ")}
                    fill="none"
                    stroke="#16a34a"
                    strokeWidth="2"
                  />
                </>
              )}
            </svg>
          </div>
        </>
      )}
    </div>
  )
}

