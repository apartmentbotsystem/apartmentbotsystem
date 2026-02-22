"use client"
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import LoadingButton from '@/components/ui/LoadingButton'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/ToastProvider'

type Row = { id: string; roomNumber: string; amount: number; adjustments: number; note: string }

export default function BillingGridPage() {
  const params = useParams<{ year: string; month: string }>()
  const year = Number(params.year)
  const month = Number(params.month)
  const [rows, setRows] = useState<Row[]>([])
  const [dirty, setDirty] = useState<Record<string, Row>>({})
  const ym = useMemo(() => `${year}-${String(month).padStart(2, '0')}`, [year, month])
  const { showSuccess, showError } = useToast()
  const [saving, setSaving] = useState(false)
  const [closing, setClosing] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/billing/records?year=${year}&month=${month}`)
      const json = await res.json()
      setRows(json.items)
      setDirty({})
    }
    if (Number.isFinite(year) && Number.isFinite(month)) load()
  }, [year, month])

  const patch = (id: string, key: keyof Row, value: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [key]: key === 'note' ? value : Number(value) } : r))
    const row = rows.find(r => r.id === id)
    if (!row) return
    const updated = { ...row, [key]: key === 'note' ? value : Number(value) }
    setDirty(d => ({ ...d, [id]: updated }))
  }

  const onSave = async () => {
    const payload = { year, month, rows: Object.values(dirty) }
    setSaving(true)
    try {
      const res = await fetch('/api/billing/records', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.ok) {
        showSuccess('บันทึกสำเร็จ')
        setDirty({})
      } else {
        const json = await res.json().catch(() => ({}))
        showError(json?.message ?? 'บันทึกล้มเหลว')
      }
    } finally {
      setSaving(false)
    }
  }

  const onCloseMonth = async () => {
    setClosing(true)
    try {
      const res = await fetch('/api/billing/close', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ year, month }) })
      if (res.ok) {
        showSuccess('ปิดรอบบิลสำเร็จ')
      } else {
        const json = await res.json().catch(() => ({}))
        showError(json?.message ?? 'ปิดรอบบิลล้มเหลว')
      }
    } finally {
      setClosing(false)
    }
  }

  return (
    <main className="container">
      <h1>แก้ไขบิล {ym}</h1>
      <table>
        <thead>
          <tr>
            <th>ห้อง</th>
            <th>ยอด</th>
            <th>ปรับปรุง</th>
            <th>หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>{r.roomNumber}</td>
              <td><input type="number" value={r.amount} onChange={e => patch(r.id, 'amount', e.target.value)} /></td>
              <td><input type="number" value={r.adjustments} onChange={e => patch(r.id, 'adjustments', e.target.value)} /></td>
              <td><input value={r.note ?? ''} onChange={e => patch(r.id, 'note', e.target.value)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <LoadingButton loading={saving} disabled={Object.keys(dirty).length === 0} onClick={onSave}>บันทึก</LoadingButton>
        <LoadingButton loading={closing} disabled={!Number.isFinite(year) || !Number.isFinite(month)} onClick={() => setConfirmClose(true)}>ปิดรอบบิล</LoadingButton>
      </div>
      <ConfirmModal
        open={confirmClose}
        title="ยืนยันการปิดรอบบิล"
        message={`ต้องการปิดรอบบิล ${ym} หรือไม่?`}
        onCancel={() => setConfirmClose(false)}
        onConfirm={() => { setConfirmClose(false); void onCloseMonth() }}
      />
    </main>
  )
}
