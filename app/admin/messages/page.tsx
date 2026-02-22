"use client"
import { useEffect, useState } from 'react'

type Conv = { id: string; roomNumber: string | null; residentId: string | null; createdAt: string }

export default function MessagesPage() {
  const [items, setItems] = useState<Conv[]>([])
  const load = async () => {
    const res = await fetch('/api/conversations')
    const json = await res.json()
    setItems(json.items)
  }
  useEffect(() => { load() }, [])
  return (
    <main className="container">
      <h1>กล่องข้อความ</h1>
      <table>
        <thead><tr><th>ห้อง</th><th>เวลา</th><th>เปิด</th></tr></thead>
        <tbody>
          {items.map(c => (
            <tr key={c.id}>
              <td>{c.roomNumber ?? '-'}</td>
              <td>{new Date(c.createdAt).toLocaleString()}</td>
              <td><a href={`/admin/messages/${c.id}`}>เปิด</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
