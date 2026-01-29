'use client'

import { useCallback, useEffect, useState } from 'react'

type Meta = { status: 'OK' | 'STALE' | 'PARTIAL' | 'ERROR'; calculatedAt: string; freshnessMs?: number; reason?: string }
type Room = { id: string; number: string; status: 'OCCUPIED' | 'AVAILABLE' | 'MAINTENANCE' }
type Contract = { startDate: string; endDate: string | null }
type TenantProfileDTO = { room: Room | null; contract: Contract | null; meta: Meta }

type InvoiceItem = { month: string; amount: number; status: 'PAID' | 'UNPAID'; invoiceId: string; payments?: Array<{ paymentId: string; paidAt: string; amount: number }> }
type TenantInvoicesDTO = { items: InvoiceItem[]; meta: Meta }

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

export default function TenantDashboardPage() {
  const [profile, setProfile] = useState<TenantProfileDTO | null>(null)
  const [profileMeta, setProfileMeta] = useState<Meta>({ status: 'OK', calculatedAt: new Date().toISOString() })
  const [invoices, setInvoices] = useState<InvoiceItem[]>([])
  const [invoiceMeta, setInvoiceMeta] = useState<Meta>({ status: 'OK', calculatedAt: new Date().toISOString() })
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = await fetchResilient<TenantProfileDTO>('/api/tenant/profile', { room: null, contract: null, meta: { status: 'ERROR', calculatedAt: new Date().toISOString() } })
      setProfile(p.data)
      setProfileMeta(p.meta)
      const inv = await fetchResilient<TenantInvoicesDTO>('/api/tenant/invoices', { items: [], meta: { status: 'ERROR', calculatedAt: new Date().toISOString() } })
      setInvoices(inv.data.items || [])
      setInvoiceMeta(inv.meta)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">Tenant Dashboard</h2>
      </div>
      <div className="text-slate-700">การติดต่อและการแจ้งชำระเงิน ให้ดำเนินการผ่าน LINE OA</div>
      {loading ? <div>กำลังโหลด...</div> : null}
      {profileMeta.status === 'ERROR' ? <div className="p-2 bg-red-100 text-red-700 rounded">เกิดข้อผิดพลาดในการคำนวณ</div> : null}
      {profileMeta.status === 'STALE' ? <div className="text-sm text-slate-500">ข้อมูลอาจไม่อัปเดตล่าสุด</div> : null}
      {profileMeta.status === 'PARTIAL' ? <div className="text-sm text-amber-600">ข้อมูลไม่ครบ: {profileMeta.reason || 'บางส่วนขาดหาย'}</div> : null}
      <div className="text-xs text-slate-500">{profileMeta.calculatedAt ? `calculatedAt: ${profileMeta.calculatedAt}` : null}</div>
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded p-4 bg-white">
          <h3 className="font-semibold mb-2">ข้อมูลห้องพัก</h3>
          <div className="space-y-1">
            <div>เลขห้อง: {profile?.room?.number ?? '-'}</div>
            <div>สถานะ: {profile?.room?.status ?? '-'}</div>
          </div>
        </div>
        <div className="border rounded p-4 bg-white">
          <h3 className="font-semibold mb-2">ข้อมูลสัญญาเช่า</h3>
          <div className="space-y-1">
            <div>เริ่ม: {profile?.contract?.startDate ?? '-'}</div>
            <div>สิ้นสุด: {profile?.contract?.endDate ?? '-'}</div>
          </div>
        </div>
      </section>
      {invoiceMeta.status === 'ERROR' ? <div className="p-2 bg-red-100 text-red-700 rounded">เกิดข้อผิดพลาดในการคำนวณ</div> : null}
      {invoiceMeta.status === 'STALE' ? <div className="text-sm text-slate-500">ข้อมูลอาจไม่อัปเดตล่าสุด</div> : null}
      {invoiceMeta.status === 'PARTIAL' ? <div className="text-sm text-amber-600">ข้อมูลไม่ครบ: {invoiceMeta.reason || 'บางส่วนขาดหาย'}</div> : null}
      <div className="text-xs text-slate-500">{invoiceMeta.calculatedAt ? `calculatedAt: ${invoiceMeta.calculatedAt}` : null}</div>
      <section className="border rounded p-4 bg-white">
        <h3 className="font-semibold mb-2">ใบแจ้งหนี้ย้อนหลัง 6 เดือน</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th>เดือน</th>
              <th>ยอดเงิน</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {(invoices || []).map((it) => (
              <tr key={it.invoiceId} className="border-t">
                <td>{it.month}</td>
                <td>{it.amount}</td>
                <td>{it.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="border rounded p-4 bg-white">
        <h3 className="font-semibold mb-2">ประวัติการชำระเงิน (ถ้ามี)</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th>เวลา</th>
              <th>ยอดเงิน</th>
              <th>Invoice</th>
            </tr>
          </thead>
          <tbody>
            {(invoices || [])
              .flatMap((it) => (it.payments || []).map((p) => ({ ...p, invoiceId: it.invoiceId })))
              .map((p) => (
                <tr key={`${p.paymentId}`} className="border-t">
                  <td>{p.paidAt}</td>
                  <td>{p.amount}</td>
                  <td>{p.invoiceId}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
      <section className="border rounded p-4 bg-white">
        <h3 className="font-semibold mb-2">สถานะการชำระเงิน</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th>Invoice</th>
              <th>PAYMENT_REPORTED</th>
              <th>CONFIRMED (PAID)</th>
            </tr>
          </thead>
          <tbody>
            {(invoices || []).map((it) => {
              const confirmedAt =
                (it.payments || []).reduce<string | null>((latest, p) => {
                  const lp = latest ? new Date(latest).getTime() : 0
                  const cp = p.paidAt ? new Date(p.paidAt).getTime() : 0
                  return cp > lp ? p.paidAt : latest
                }, null) || "-"
              return (
                <tr key={`timeline-${it.invoiceId}`} className="border-t">
                  <td>{it.invoiceId}</td>
                  <td>-</td>
                  <td>{confirmedAt}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="text-xs text-slate-500 mt-2">เวลาถูกแสดงเป็นรูปแบบมาตรฐานและอิงข้อมูลที่มีอยู่</div>
      </section>
    </div>
  )
}
