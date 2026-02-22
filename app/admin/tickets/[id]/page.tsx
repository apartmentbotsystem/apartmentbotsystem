"use client"
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Ticket = { id: string; roomNumber: string; status: string; messages: { id: string; sender: 'ADMIN' | 'RESIDENT'; text: string; createdAt: string }[] }

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [t, setT] = useState<Ticket | null>(null)
  const [text, setText] = useState('')
  const [status, setStatus] = useState('OPEN')

  const load = async () => {
    const res = await fetch(`/api/tickets/${id}`)
    if (res.ok) {
      const json = await res.json()
      setT(json); setStatus(json.status)
    }
  }
  useEffect(() => { if (id) load() }, [id])

  const send = async () => {
    if (!text) return
    await fetch(`/api/tickets/${id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, sender: 'ADMIN' }) })
    setText('')
    await load()
  }
  const saveStatus = async () => {
    await fetch(`/api/tickets/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    await load()
  }

  if (!t) return <main className="container"><p>Loading...</p></main>

  return (
    <main className="container">
      <h1>ทิกเก็ต {t.roomNumber}</h1>
      <div>
        <label>สถานะ: </label>
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="OPEN">OPEN</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="CLOSED">CLOSED</option>
        </select>
        <button onClick={saveStatus}>บันทึก</button>
      </div>
      <ul>
        {t.messages.map(m => <li key={m.id}>[{m.sender}] {new Date(m.createdAt).toLocaleString()} - {m.text}</li>)}
      </ul>
      <div>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="พิมพ์ข้อความ" />
        <button onClick={send} disabled={!text}>ส่ง</button>
      </div>
    </main>
  )
}
