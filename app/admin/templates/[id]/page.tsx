"use client"
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import LoadingButton from '@/components/ui/LoadingButton'
import { useToast } from '@/components/ui/ToastProvider'

type Template = { id: string; code: string; name: string; createdAt: string }
type PH = { key: string; normalizedKey: string; sample: unknown }

export default function TemplateEditPage() {
  const { id } = useParams<{ id: string }>()
  const [tpl, setTpl] = useState<Template | null>(null)
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const { showSuccess, showError } = useToast()
  const [savingName, setSavingName] = useState(false)
  const [replacing, setReplacing] = useState(false)

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [roomNumber, setRoomNumber] = useState('')
  const [items, setItems] = useState<PH[]>([])
  const ym = useMemo(() => `${year}-${String(month).padStart(2, '0')}`, [year, month])

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/templates/${id}`)
      if (res.ok) {
        const json = await res.json()
        setTpl(json); setName(json.name)
      }
    }
    if (id) load()
  }, [id])

  const saveName = async () => {
    if (!name.trim()) return
    setSavingName(true)
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
      if (res.ok) showSuccess('บันทึกชื่อสำเร็จ')
      else {
        const json = await res.json().catch(() => ({}))
        showError(json?.message ?? 'บันทึกชื่อไม่สำเร็จ')
      }
    } finally {
      setSavingName(false)
    }
  }
  const replaceFile = async () => {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    setReplacing(true)
    try {
      const res = await fetch(`/api/templates/${id}/replace`, { method: 'POST', body: fd })
      if (res.ok) {
        showSuccess('อัปเดตไฟล์สำเร็จ')
        setFile(null)
      } else {
        const json = await res.json().catch(() => ({}))
        showError(json?.message ?? 'อัปเดตไฟล์ไม่สำเร็จ')
      }
    } finally {
      setReplacing(false)
    }
  }

  const loadPH = async () => {
    const qs = new URLSearchParams({ year: String(year), month: String(month), ...(roomNumber ? { roomNumber } : {}) })
    const res = await fetch('/api/billing/placeholders?' + qs.toString())
    if (res.ok) {
      const json = await res.json()
      setItems(json.items)
    }
  }
  useEffect(() => { loadPH() }, [year, month, roomNumber])

  const copy = async (text: string) => { await navigator.clipboard.writeText(text) }

  if (!tpl) return <main className="container"><p>Loading...</p></main>

  return (
    <main className="container">
      <h1>แก้ไข Template: {tpl.code}</h1>
      <section>
        <h2>ชื่อแสดงผล</h2>
        <input value={name} onChange={e => setName(e.target.value)} />
        <LoadingButton onClick={saveName} loading={savingName} disabled={!name.trim()}>บันทึกชื่อ</LoadingButton>
      </section>
      <section>
        <h2>แทนไฟล์ .docx</h2>
        <input type="file" accept=".docx" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        <LoadingButton onClick={replaceFile} loading={replacing} disabled={!file}>อัปเดตไฟล์</LoadingButton>
      </section>
      <section>
        <h2>Placeholders สำหรับ {ym}</h2>
        <div>
          <label>ปี: </label>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} />
          <label>เดือน: </label>
          <input type="number" min={1} max={12} value={month} onChange={e => setMonth(Number(e.target.value))} />
          <label>ห้อง (ถ้ามี): </label>
          <input value={roomNumber} onChange={e => setRoomNumber(e.target.value)} placeholder="เว้นว่างเพื่อรวมทุกห้อง" />
        </div>
        <table>
          <thead>
            <tr>
              <th>หัวตาราง (ตรงตัว)</th>
              <th>Normalized</th>
              <th>ตัวอย่างค่า</th>
              <th>คัดลอก</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.key}>
                <td>{it.key}</td>
                <td>{it.normalizedKey}</td>
                <td><code>{String(it.sample ?? '')}</code></td>
                <td>
                  <button onClick={() => copy(`{${it.key}}`)}>Copy {'{'}{it.key}{'}'}</button>
                  <button onClick={() => copy(`{${it.normalizedKey}}`)} style={{ marginLeft: 8 }}>Copy {'{'}{it.normalizedKey}{'}'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  )
}
