"use client"
import { useEffect, useMemo, useState } from 'react'
import { formatYm } from '@/lib/datetime'
import PageHeader from '@/components/system/PageHeader'
import PageContainer from '@/components/system/PageContainer'

type Item = { key: string; normalizedKey: string; sample: unknown }

export default function PlaceholdersPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [roomNumber, setRoomNumber] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const ym = useMemo(() => formatYm(year, month), [year, month])

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
    <PageContainer>
      <PageHeader title="Available placeholders" subtitle={ym} />
      <div className="space-y-3 mt-4">
        <form className="flex flex-wrap items-end gap-2 text-sm">
          <div>
            <label className="block text-xs">ปี</label>
            <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="border erp-border rounded px-2 py-1 w-28" />
          </div>
          <div>
            <label className="block text-xs">เดือน</label>
            <input type="number" min={1} max={12} value={month} onChange={e => setMonth(Number(e.target.value))} className="border erp-border rounded px-2 py-1 w-20" />
          </div>
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs">ห้อง (ถ้ามี)</label>
            <input value={roomNumber} onChange={e => setRoomNumber(e.target.value)} placeholder="เว้นว่างเพื่อรวมทุกห้อง" className="border erp-border rounded px-2 py-1 w-full" />
          </div>
        </form>
        <div className="overflow-auto border erp-border rounded">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="[&>th]:px-2 [&>th]:py-2 border-b erp-border text-left bg-[var(--bg-page)]">
                <th>หัวตาราง (ตรงตัว)</th>
                <th>Normalized</th>
                <th>ตัวอย่างค่า</th>
                <th className="text-right">คัดลอก</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.key} className="[&>td]:px-2 [&>td]:py-1 border-b erp-border">
                  <td>{it.key}</td>
                  <td>{it.normalizedKey}</td>
                  <td><code>{String(it.sample ?? '')}</code></td>
                  <td className="text-right">
                    <button onClick={() => copy(`{${it.key}}`)} className="px-2 py-1 border erp-border rounded text-xs">Copy {'{'}{it.key}{'}'}</button>
                    <button onClick={() => copy(`{${it.normalizedKey}}`)} className="px-2 py-1 border erp-border rounded text-xs ml-2">Copy {'{'}{it.normalizedKey}{'}'}</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={4} className="px-2 py-6 text-center opacity-70">ไม่มีข้อมูล</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  )
}
