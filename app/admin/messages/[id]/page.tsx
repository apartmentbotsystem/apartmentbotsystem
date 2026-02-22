"use client"
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Msg = { id: string; sender: 'ADMIN' | 'RESIDENT'; text: string; createdAt: string }

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>()
  const [items, setItems] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const load = async () => {
    const res = await fetch(`/api/conversations/${id}/messages`)
    if (res.ok) {
      const json = await res.json()
      setItems(json.items)
    }
  }
  useEffect(() => { if (id) load() }, [id])
  const send = async () => {
    if (!text) return
    await fetch(`/api/conversations/${id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, sender: 'ADMIN' }) })
    setText('')
    await load()
  }
  return (
    <main className="container">
      <h1>สนทนา</h1>
      <ul>
        {items.map(m => <li key={m.id}>[{m.sender}] {new Date(m.createdAt).toLocaleString()} - {m.text}</li>)}
      </ul>
      <div>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="พิมพ์ข้อความ" />
        <button onClick={send} disabled={!text}>ส่ง</button>
      </div>
    </main>
  )
}
