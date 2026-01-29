'use client'

import { useEffect, useState } from 'react'

type ReportedItem = {
  invoiceId: string
  tenant: { id: string; name: string } | null
  room: { id: string; roomNumber: string } | null
  periodMonth: string
  amount: number
  invoiceStatus: 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED'
  reportedAt: string
  pending: boolean
  resolved: boolean
  lineUserIdMasked?: string
}

type ReportedPaymentListDTO = { items: ReadonlyArray<ReportedItem> }

type Meta = { status: 'OK' | 'STALE' | 'PARTIAL' | 'ERROR'; calculatedAt: string; reason?: string }

async function fetchResilient<T>(url: string, fallback: T): Promise<{ data: T; meta: Meta }> {
  const now = new Date()
  try {
    const res = await fetch(url, { headers: { accept: 'application/vnd.apartment.v1.1+json' }, cache: 'no-store' })
    const json = await res.json()
    if (json?.success) return { data: json.data as T, meta: { status: 'OK', calculatedAt: now.toISOString() } }
    return { data: fallback, meta: { status: 'ERROR', calculatedAt: now.toISOString(), reason: 'Invalid envelope' } }
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'Unknown error'
    return { data: fallback, meta: { status: 'ERROR', calculatedAt: now.toISOString(), reason } }
  }
}

export default function Page() {
  const [items, setItems] = useState<ReportedItem[]>([])
  const [meta, setMeta] = useState<Meta>({ status: 'OK', calculatedAt: new Date().toISOString() })

  useEffect(() => {
    ;(async () => {
      const { data, meta } = await fetchResilient<ReportedPaymentListDTO>('/api/admin/payments/reported', { items: [] })
      setItems((data.items as ReportedItem[]) || [])
      setMeta(meta)
    })()
  }, [])

  const banner =
    meta.status === 'STALE'
      ? 'ข้อมูลอาจไม่อัปเดตล่าสุด'
      : meta.status === 'PARTIAL'
      ? 'ข้อมูลบางส่วนไม่พร้อมใช้งาน'
      : meta.status === 'ERROR'
      ? 'เกิดข้อผิดพลาดในการโหลดข้อมูล'
      : null

  return (
    <div style={{ padding: 16 }}>
      <h1>รายการแจ้งโอน (Reported Payments)</h1>
      {banner && <div style={{ marginTop: 8, padding: 8, background: '#fde68a' }}>{banner}</div>}
      <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>ข้อมูล ณ เวลา {new Date(meta.calculatedAt).toLocaleString()}</div>
      <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>วันที่แจ้ง</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>ห้อง / ผู้เช่า</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>เดือนบิล</th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>ยอดเงิน</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>สถานะ</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>การทำงาน</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: 16, textAlign: 'center', color: '#666' }}>
                ไม่มีรายการแจ้งโอน
              </td>
            </tr>
          )}
          {items.map((it) => (
            <tr key={`${it.invoiceId}-${it.reportedAt}`}>
              <td style={{ padding: 8 }}>{new Date(it.reportedAt).toLocaleString()}</td>
              <td style={{ padding: 8 }}>
                {it.room?.roomNumber ?? '-'} / {it.tenant?.name ?? '-'}
              </td>
              <td style={{ padding: 8 }}>{it.periodMonth}</td>
              <td style={{ padding: 8, textAlign: 'right' }}>{it.amount}</td>
              <td style={{ padding: 8 }}>{it.resolved ? 'Paid' : 'Pending'}</td>
              <td style={{ padding: 8 }}>
                <a href={`/admin/invoices/${it.invoiceId}`}>ตรวจสอบบิล</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

