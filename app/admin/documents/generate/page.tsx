"use client"
import { useEffect, useMemo, useState } from 'react'
import LoadingButton from '@/components/ui/LoadingButton'
import { ConfirmActionButton } from '@/components/ui/ConfirmPostButton'
import { useToast } from '@/components/ui/ToastProvider'
import { formatYm } from '@/lib/datetime'
import RoomSelector from '@/components/form/RoomSelector'
import useAsyncAction from '@/hooks/useAsyncAction'
import { toDisplayZoned } from '@/lib/time'

type Template = { id: string; code: string; name: string }
type Version = { id: string; versionNo: number; status: string; generatedAt: string; template: { code: string; name: string }, roomNumber: string }

export default function GeneratePage() {
  const now = new Date()
  const [templates, setTemplates] = useState<Template[]>([])
  const [templateId, setTemplateId] = useState('')
  const [roomNumber, setRoomNumber] = useState('')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [versions, setVersions] = useState<Version[]>([])
  const ym = useMemo(() => formatYm(year, month), [year, month])
  const [creating, setCreating] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const { showSuccess, showError } = useToast()

  const loadTemplates = async () => {
    const res = await fetch('/api/templates')
    const json = await res.json()
    setTemplates(json.items)
  }
  const loadVersions = async () => {
    const qs = new URLSearchParams({ year: String(year), month: String(month), ...(roomNumber ? { roomNumber } : {}) })
    const res = await fetch('/api/documents?' + qs.toString())
    const json = await res.json()
    setVersions(json.items)
  }
  useEffect(() => { loadTemplates() }, [])
  useEffect(() => { loadVersions() }, [year, month, roomNumber])

  const onGenerate = useAsyncAction(async () => {
    if (!templateId || !roomNumber) return
    const fd = new FormData()
    fd.append('templateId', templateId)
    fd.append('roomNumber', roomNumber)
    fd.append('year', String(year))
    fd.append('month', String(month))
    const res = await fetch('/api/documents/generate', { method: 'POST', body: fd })
    const json = await res.json()
    if (res.ok && json?.id) {
      showSuccess('สร้างเอกสารสำเร็จ')
      await loadVersions()
    } else {
      showError(json?.message ?? 'สร้างเอกสารล้มเหลว')
    }
  })

  const sendOne = async (id: string) => {
    setSending(id)
    try {
      const res = await fetch('/api/documents/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentVersionId: id }) })
      if (res.ok) {
        showSuccess('ส่งเอกสารสำเร็จ')
        await loadVersions()
      } else {
        const json = await res.json().catch(() => ({} as any))
        showError(json?.message ?? 'ส่งเอกสารล้มเหลว')
      }
    } finally {
      setSending(null)
    }
  }

  const sendAll = useAsyncAction(async () => {
    const targets = versions.filter(v => v.status !== 'SENT').map(v => v.id)
    if (!targets.length) {
      showSuccess('ไม่มีเอกสารที่ต้องส่ง')
      return
    }
    let ok = 0
    for (const id of targets) {
      const res = await fetch('/api/documents/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentVersionId: id }) })
      if (res.ok) ok++
    }
    await loadVersions()
    showSuccess(`ส่งเอกสารสำเร็จ ${ok}/${targets.length}`)
  })

  return (
    <main className="container">
      <h1>สร้างเอกสาร {ym}</h1>
      <form onSubmit={(e) => { e.preventDefault(); void onGenerate.run() }}>
        <div>
          <label>Template: </label>
          <select value={templateId} onChange={e => setTemplateId(e.target.value)}>
            <option value="">-- เลือก --</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
          </select>
        </div>
        <div>
          <label>ห้อง: </label>
          <RoomSelector value={roomNumber} onChange={setRoomNumber} searchable />
        </div>
        <div>
          <label>ปี: </label>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} />
          <label>เดือน: </label>
          <input type="number" min={1} max={12} value={month} onChange={e => setMonth(Number(e.target.value))} />
        </div>
        <LoadingButton loading={onGenerate.loading} disabled={!templateId || !roomNumber} type="submit">สร้าง</LoadingButton>
      </form>

      <h2>รายการเอกสารที่สร้างแล้ว</h2>
      <div style={{ margin: '8px 0' }}>
        <LoadingButton loading={sendAll.loading} onClick={() => sendAll.run()}>ส่งทั้งหมด</LoadingButton>
      </div>
      <table>
        <thead>
          <tr>
            <th>Template</th>
            <th>ห้อง</th>
            <th>เวอร์ชัน</th>
            <th>เวลา</th>
            <th>ดาวน์โหลด</th>
            <th>ส่ง</th>
          </tr>
        </thead>
        <tbody>
          {versions.map(v => (
            <tr key={v.id}>
              <td>{v.template.code} — {v.template.name}</td>
              <td>{v.roomNumber}</td>
              <td>v{v.versionNo}</td>
                  <td>{toDisplayZoned(v.generatedAt)}</td>
              <td><a href={`/api/documents/${v.id}/download`} target="_blank" rel="noreferrer">ดาวน์โหลด</a></td>
              <td>
                <ConfirmActionButton
                  title="ยืนยันการส่งเอกสาร"
                  description="เมื่อส่งแล้วจะไม่สามารถส่งซ้ำได้"
                  disabled={v.status === 'SENT'}
                  url="/api/documents/send"
                  method="POST"
                  json={{ documentVersionId: v.id }}
                  successMessage="ส่งเอกสารสำเร็จ"
                  reload
                >
                  ส่ง
                </ConfirmActionButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
