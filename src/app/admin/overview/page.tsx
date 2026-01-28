'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { BillingAgingMetricsDTO } from '@/application/dto/billing-aging.dto'
type BucketKey = 'd0_7' | 'd8_30' | 'd31_plus'
type DrilldownItem = { id: string; roomId: string | null; tenantId: string | null; totalAmount: number; dueDate: string; overdueDays: number }

type Totals = { issuedCount: number; sentCount: number; paidCount: number; unpaidCount: number }
type Amounts = { paidTotal: number; unpaidTotal: number }
type TrendItem = { date: string; count: number }
type Meta = { status: 'OK' | 'STALE' | 'PARTIAL' | 'ERROR'; calculatedAt: string; freshnessMs?: number; reason?: string }

function currentMonth(): string {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

async function fetchEnvelope<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: 'application/vnd.apartment.v1.1+json' }, cache: 'no-store' })
  const json = await res.json()
  if (json && typeof json === 'object' && 'success' in json) {
    if (json.success) return json.data as T
    const message = (json.error && json.error.message) || 'Error'
    throw new Error(String(message))
  }
  return json as T
}

async function fetchResilient<T>(url: string, fallback: T): Promise<{ data: T; meta: Meta }> {
  const now = new Date()
  try {
    const res = await fetch(url, { headers: { accept: 'application/vnd.apartment.v1.1+json' }, cache: 'no-store' })
    const json = await res.json()
    if (json && typeof json === 'object' && 'success' in json) {
      if (json.success) {
        const m = (json.data && (json.data.meta as Meta)) || { status: 'OK', calculatedAt: now.toISOString() }
        return { data: json.data as T, meta: m }
      }
      const message = (json.error && json.error.message) || 'Error'
      return { data: fallback, meta: { status: 'ERROR', calculatedAt: now.toISOString(), reason: String(message) } }
    }
    return { data: (json as T) ?? fallback, meta: { status: 'OK', calculatedAt: now.toISOString() } }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { data: fallback, meta: { status: 'ERROR', calculatedAt: now.toISOString(), reason: msg } }
  }
}

export default function AdminOverviewPage() {
  const [month, setMonth] = useState<string>(currentMonth())
  const [totals, setTotals] = useState<Totals | null>(null)
  const [amounts, setAmounts] = useState<Amounts | null>(null)
  const [sentDaily, setSentDaily] = useState<TrendItem[]>([])
  const [paidDaily, setPaidDaily] = useState<TrendItem[]>([])
  const [occ, setOcc] = useState<{ totalRooms: number; occupiedRooms: number; vacantRooms: number; occupancyRate: number } | null>(null)
  const [moveInDaily, setMoveInDaily] = useState<TrendItem[]>([])
  const [moveOutDaily, setMoveOutDaily] = useState<TrendItem[]>([])
  const [aging, setAging] = useState<BillingAgingMetricsDTO | null>(null)
  const [billingMeta, setBillingMeta] = useState<Meta | null>(null)
  const [occupancyMeta, setOccupancyMeta] = useState<Meta | null>(null)
  const [agingMeta, setAgingMeta] = useState<Meta | null>(null)
  const [selectedBucket, setSelectedBucket] = useState<BucketKey | null>(null)
  const [drillItems, setDrillItems] = useState<DrilldownItem[] | null>(null)
  const [drillLoading, setDrillLoading] = useState(false)
  const [drillError, setDrillError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const billing = await fetchResilient<{
        periodMonth: string
        totals: Totals
        amounts: Amounts
        trends: { sentDaily: TrendItem[]; paidDaily: TrendItem[] }
        meta?: Meta
      }>(`/api/metrics/billing/overview?month=${encodeURIComponent(month)}`, {
        periodMonth: month,
        totals: { issuedCount: 0, sentCount: 0, paidCount: 0, unpaidCount: 0 },
        amounts: { paidTotal: 0, unpaidTotal: 0 },
        trends: { sentDaily: [], paidDaily: [] },
      })
      setTotals(billing.data.totals)
      setAmounts(billing.data.amounts)
      setSentDaily(billing.data.trends.sentDaily)
      setPaidDaily(billing.data.trends.paidDaily)
      setBillingMeta(billing.meta)
      const occRes = await fetchResilient<{
        periodMonth: string
        kpis: { totalRooms: number; occupiedRooms: number; vacantRooms: number; occupancyRate: number }
        monthly: { moveInCount: number; moveOutCount: number }
        trends: { moveInDaily: TrendItem[]; moveOutDaily: TrendItem[] }
        meta?: Meta
      }>(`/api/metrics/occupancy/overview?month=${encodeURIComponent(month)}`, {
        periodMonth: month,
        kpis: { totalRooms: 0, occupiedRooms: 0, vacantRooms: 0, occupancyRate: 0 },
        monthly: { moveInCount: 0, moveOutCount: 0 },
        trends: { moveInDaily: [], moveOutDaily: [] },
      })
      setOcc(occRes.data.kpis)
      setMoveInDaily(occRes.data.trends.moveInDaily)
      setMoveOutDaily(occRes.data.trends.moveOutDaily)
      setOccupancyMeta(occRes.meta)
      const agingData = await fetchEnvelope<BillingAgingMetricsDTO>(`/api/metrics/billing/aging?month=${encodeURIComponent(month)}`)
      setAging(agingData)
      setAgingMeta({
        status: agingData.meta.status === 'STALE' ? 'STALE' : 'OK',
        calculatedAt: agingData.meta.calculatedAt,
        freshnessMs: agingData.meta.freshnessMs,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setTotals(null)
      setAmounts(null)
      setSentDaily([])
      setPaidDaily([])
      setOcc(null)
      setMoveInDaily([])
      setMoveOutDaily([])
      setAging(null)
      setBillingMeta({ status: 'ERROR', calculatedAt: new Date().toISOString(), reason: 'โหลดข้อมูลล้มเหลว' })
      setOccupancyMeta({ status: 'ERROR', calculatedAt: new Date().toISOString(), reason: 'โหลดข้อมูลล้มเหลว' })
      setAgingMeta({ status: 'ERROR', calculatedAt: new Date().toISOString(), reason: 'โหลดข้อมูลล้มเหลว' })
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => {
    void load()
  }, [load])

  const openDrilldown = useCallback(
    async (bucket: BucketKey) => {
      setSelectedBucket(bucket)
      setDrillLoading(true)
      setDrillError(null)
      setDrillItems(null)
      try {
        const data = await fetchEnvelope<{ periodMonth: string; bucket: BucketKey; items: DrilldownItem[] }>(
          `/api/metrics/billing/aging/${bucket}?month=${encodeURIComponent(month)}`,
        )
        setDrillItems(Array.isArray(data.items) ? data.items : [])
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setDrillError(msg)
        setDrillItems([])
      } finally {
        setDrillLoading(false)
      }
    },
    [month],
  )

  const closeDrilldown = useCallback(() => {
    setSelectedBucket(null)
    setDrillItems(null)
    setDrillError(null)
    setDrillLoading(false)
  }, [])

  const kpiCards = useMemo(
    () => [
      { label: 'Issued', value: totals?.issuedCount ?? 0 },
      { label: 'Sent', value: totals?.sentCount ?? 0 },
      { label: 'Paid', value: totals?.paidCount ?? 0 },
      { label: 'Unpaid', value: totals?.unpaidCount ?? 0 },
      { label: 'Paid Amount', value: amounts?.paidTotal ?? 0 },
      { label: 'Unpaid Amount', value: amounts?.unpaidTotal ?? 0 },
      { label: 'Rooms', value: occ?.totalRooms ?? 0 },
      { label: 'Occupied', value: occ?.occupiedRooms ?? 0 },
      { label: 'Vacant', value: occ?.vacantRooms ?? 0 },
      { label: 'Occupancy %', value: occ?.occupancyRate ?? 0 },
    ],
    [totals, amounts, occ],
  )

  function link(href: string, text: string) {
    return (
      <a className="px-3 py-1 rounded bg-slate-700 text-white" href={href}>
        {text}
      </a>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="font-semibold text-lg">Admin Overview (Billing)</h2>
      <div className="flex items-center gap-3">
        <label className="text-sm">Month</label>
        <input
          className="border px-2 py-1 rounded"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          placeholder="YYYY-MM"
        />
        <button className="px-3 py-1 rounded bg-slate-800 text-white" onClick={() => void load()}>
          โหลดข้อมูล
        </button>
      </div>
      {error ? <div className="text-red-600">{error}</div> : null}
      {loading ? <div>กำลังโหลด...</div> : null}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.map((k) => (
          <div key={k.label} className="p-3 border rounded">
            <div className="text-slate-600 text-sm">{k.label}</div>
            <div className="text-lg font-semibold">{k.value}</div>
          </div>
        ))}
      </div>
      <div className="text-xs text-slate-500">
        {billingMeta?.status === 'STALE' ? 'ข้อมูลอาจไม่อัปเดตล่าสุด' : billingMeta?.status === 'ERROR' ? 'เกิดข้อผิดพลาดในการคำนวณ' : null}
        {billingMeta?.calculatedAt ? ` • calculatedAt: ${billingMeta.calculatedAt}` : null}
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">Trend Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 border rounded">
            <div className="text-slate-600 text-sm mb-2">Sent per day</div>
            <ul className="space-y-1">
              {sentDaily.slice(0, 14).map((it) => (
                <li key={it.date} className="flex justify-between">
                  <span className="text-slate-600">{it.date}</span>
                  <span className="font-medium">{it.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="p-3 border rounded">
            <div className="text-slate-600 text-sm mb-2">Paid per day</div>
            <ul className="space-y-1">
              {paidDaily.slice(0, 14).map((it) => (
                <li key={it.date} className="flex justify-between">
                  <span className="text-slate-600">{it.date}</span>
                  <span className="font-medium">{it.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="p-3 border rounded">
            <div className="text-slate-600 text-sm mb-2">Move-in per day</div>
            <ul className="space-y-1">
              {moveInDaily.slice(0, 14).map((it) => (
                <li key={it.date} className="flex justify-between">
                  <span className="text-slate-600">{it.date}</span>
                  <span className="font-medium">{it.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="p-3 border rounded">
            <div className="text-slate-600 text-sm mb-2">Move-out per day</div>
            <ul className="space-y-1">
              {moveOutDaily.slice(0, 14).map((it) => (
                <li key={it.date} className="flex justify-between">
                  <span className="text-slate-600">{it.date}</span>
                  <span className="font-medium">{it.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="text-xs text-slate-500">
            {occupancyMeta?.status === 'STALE' ? 'ข้อมูลอาจไม่อัปเดตล่าสุด' : occupancyMeta?.status === 'ERROR' ? 'เกิดข้อผิดพลาดในการคำนวณ' : null}
            {occupancyMeta?.calculatedAt ? ` • calculatedAt: ${occupancyMeta.calculatedAt}` : null}
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">Aging (Overdue)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {aging?.bucketsOrdered.map((b) => (
            <button
              key={b.key}
              className="p-3 border rounded text-left hover:bg-slate-50"
              onClick={() => void openDrilldown(b.key as BucketKey)}
              aria-label={`View ${b.label} invoices`}
            >
              <div className="text-slate-600 text-sm">{b.label}</div>
              <div className="text-lg font-semibold">{b.count}</div>
              <div className="text-slate-600 text-sm">Amount: {b.totalAmount}</div>
            </button>
          ))}
          <div className="p-3 border rounded">
            <div className="text-slate-600 text-sm">% Overdue vs Issued</div>
            <div
              className="text-lg font-semibold"
              title={aging && aging.totals.issuedCount === 0 ? 'No issued invoices in this period' : undefined}
            >
              {aging && aging.totals.issuedCount === 0 ? '—' : `${aging?.totals.overduePercentOfIssued ?? 0}%`}
            </div>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          {agingMeta?.status === 'STALE' ? 'ข้อมูลอาจไม่อัปเดตล่าสุด' : agingMeta?.status === 'ERROR' ? 'เกิดข้อผิดพลาดในการคำนวณ' : null}
          {agingMeta?.calculatedAt ? ` • calculatedAt: ${agingMeta.calculatedAt}` : null}
        </div>
        {selectedBucket ? (
          <div className="mt-3 p-3 border rounded">
            <div className="flex items-center justify-between">
              <div className="font-semibold">
                Drilldown: {aging?.bucketsOrdered.find((b) => b.key === selectedBucket)?.label || selectedBucket}
              </div>
              <button className="px-2 py-1 rounded bg-slate-800 text-white" onClick={closeDrilldown}>
                ปิด
              </button>
            </div>
            {drillError ? <div className="text-red-600">{drillError}</div> : null}
            {drillLoading ? <div>กำลังโหลด...</div> : null}
            {!drillLoading && !drillError ? (
              drillItems && drillItems.length > 0 ? (
                <table className="w-full text-sm mt-2">
                  <thead>
                    <tr className="text-left">
                      <th>Invoice</th>
                      <th>Room</th>
                      <th>Tenant</th>
                      <th>Due Date</th>
                      <th>Overdue Days</th>
                      <th>Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drillItems.map((it) => (
                      <tr key={it.id} className="border-t">
                        <td>{it.id}</td>
                        <td>{it.roomId ?? '-'}</td>
                        <td>{it.tenantId ?? '-'}</td>
                        <td>{it.dueDate}</td>
                        <td>{it.overdueDays}</td>
                        <td>{it.totalAmount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-slate-500 mt-2">ไม่มีบิลในหมวดนี้</div>
              )
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="space-x-2">
        {link("/app/admin/invoices", "ไปที่ Invoices")}
        {link("/app/dashboard", "ไปที่ Dashboard")}
      </div>
    </div>
  )
}
