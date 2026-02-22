"use client"
import { useEffect, useMemo, useState } from 'react'
import LoadingButton from '@/components/ui/LoadingButton'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/ToastProvider'

type Payment = { id: string; amount: number; bankRef: string | null; occurredAt: string; matched: boolean }
type RecordRow = { id: string; roomNumber: string }

export default function PaymentsPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [payments, setPayments] = useState<Payment[]>([])
  const [roomNumber, setRoomNumber] = useState('')
  const [records, setRecords] = useState<RecordRow[]>([])
  const ym = useMemo(() => `${year}-${String(month).padStart(2, '0')}`, [year, month])
  const { showSuccess, showError } = useToast()
  const [confirm, setConfirm] = useState<{ open: boolean; paymentId?: string; billingRecordId?: string; amount?: number }>(
    { open: false }
  )
  const [loading, setLoading] = useState(false)

  const load = async () => {
    const res = await fetch(`/api/payments?year=${year}&month=${month}`)
    const json = await res.json()
    setPayments(json.items.map((p: { id: string; amount: number | string; bankRef: string | null; occurredAt: string; matched: boolean }) => ({ ...p, amount: Number(p.amount) })))
    const res2 = await fetch(`/api/billing/records?year=${year}&month=${month}`)
    const json2 = await res2.json()
    setRecords(json2.items.map((r: { id: string; roomNumber: string }) => ({ id: r.id, roomNumber: r.roomNumber })))
  }
  useEffect(() => { load() }, [year, month])

  const doMatch = async (paymentId: string, billingRecordId: string, amount: number) => {
    setLoading(true)
    try {
      const res = await fetch('/api/payments/match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentId, billingRecordId, amount, confirm: true }) })
      if (res.ok) {
        showSuccess('จับคู่สำเร็จ')
        await load()
      } else {
        const json = await res.json().catch(() => ({}))
        showError(json?.message ?? 'จับคู่ล้มเหลว')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="container">
      <h1>ชำระเงิน {ym}</h1>
      <div>
        <label>ปี: </label>
        <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} />
        <label>เดือน: </label>
        <input type="number" min={1} max={12} value={month} onChange={e => setMonth(Number(e.target.value))} />
        <a href="/admin/payments/import" style={{ marginLeft: 12 }}>อัปโหลด</a>
      </div>
      <table>
        <thead><tr><th>เวลา</th><th>จำนวนเงิน</th><th>อ้างอิงธนาคาร</th><th>จับคู่</th></tr></thead>
        <tbody>
          {payments.map(p => (
            <tr key={p.id}>
              <td>{new Date(p.occurredAt).toLocaleString()}</td>
              <td>{p.amount.toLocaleString()}</td>
              <td>{p.bankRef ?? ''}</td>
              <td>
                <select value={roomNumber} onChange={e => setRoomNumber(e.target.value)}>
                  <option value="">เลือกห้อง</option>
                  {records.map(r => <option key={r.id} value={`${r.id}`}>{r.roomNumber}</option>)}
                </select>
                <LoadingButton
                  loading={loading}
                  disabled={!roomNumber || p.matched}
                  onClick={() => setConfirm({ open: true, paymentId: p.id, billingRecordId: roomNumber, amount: p.amount })}
                >
                  จับคู่
                </LoadingButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ConfirmModal
        open={confirm.open}
        title="ยืนยันการจับคู่"
        message="ต้องการยืนยันการจับคู่ยอดชำระนี้หรือไม่?"
        onCancel={() => setConfirm({ open: false })}
        onConfirm={() => {
          if (confirm.paymentId && confirm.billingRecordId && typeof confirm.amount === 'number') {
            void doMatch(confirm.paymentId, confirm.billingRecordId, confirm.amount)
          }
          setConfirm({ open: false })
        }}
      />
    </main>
  )
}
