"use client"
import { useEffect, useState } from 'react'
import RoomSelector from '@/components/form/RoomSelector'
import { toDisplayZoned } from '@/lib/time'

type Ticket = { id: string; roomNumber: string; status: string; createdAt: string }

export default function TicketsPage() {
  const [items, setItems] = useState<Ticket[]>([])
  const [roomNumber, setRoomNumber] = useState('')
  const [text, setText] = useState('')

  const load = async () => {
    const res = await fetch('/api/tickets')
    const json = await res.json()
    setItems(json.items)
  }
  useEffect(() => { load() }, [])

  const createTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomNumber || !text) return
    await fetch('/api/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomNumber, text }) })
    setRoomNumber(''); setText('')
    await load()
  }

  return (
    <main className="container">
      <h1>ทิกเก็ต</h1>
      <form onSubmit={createTicket}>
        <RoomSelector value={roomNumber} onChange={setRoomNumber} searchable />
        <input placeholder="ข้อความแรก" value={text} onChange={e => setText(e.target.value)} />
        <button disabled={!roomNumber || !text} type="submit">สร้าง</button>
      </form>
      <table>
        <thead><tr><th>ห้อง</th><th>สถานะ</th><th>เวลา</th><th>ดู</th></tr></thead>
        <tbody>
          {items.map(t => (
            <tr key={t.id}>
              <td>{t.roomNumber}</td>
              <td>{t.status}</td>
              <td>{toDisplayZoned(t.createdAt)}</td>
              <td><a href={`/admin/tickets/${t.id}`}>เปิด</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
