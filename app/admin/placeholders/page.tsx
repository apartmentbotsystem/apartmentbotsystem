"use client"
import { useEffect, useMemo, useState } from 'react'

type Item = { key: string; normalizedKey: string; sample: unknown }

export default function PlaceholdersPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [roomNumber, setRoomNumber] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const ym = useMemo(() => `${year}-${String(month).padStart(2, '0')}`, [year, month])

  const load = async () => {
    const qs = new URLSearchParams({ year: String(year), month: String(month), ...(roomNumber ? { roomNumber } : {}) })
    const res = await fetch('/api/billing/placeholders?' + qs.toString())
    const json = await res.json()
    setItems(json.items)
  }
  useEffect(() => { load() }, [year, month, roomNumber])

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
  }

  return (
    <main className="container">
      <h1>Available placeholders {ym}</h1>
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
    </main>
  )
}
