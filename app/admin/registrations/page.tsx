"use client"

import { useEffect, useState } from 'react'

type Item = {
  id: string
  lineUserId: string
  roomNumber: string
  residentName: string | null
  phone: string | null
  createdAt: string
}

async function fetchPending(): Promise<Item[]> {
  const res = await fetch('/api/admin/registration/pending', { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return data.items ?? []
}

export default function Page() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  async function reload() {
    setLoading(true)
    const list = await fetchPending()
    setItems(list)
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [])

  async function approve(id: string) {
    await fetch(`/api/admin/registration/${id}/approve`, { method: 'POST' })
    await reload()
  }
  async function reject(id: string) {
    await fetch(`/api/admin/registration/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    })
    setRejecting(null)
    setReason('')
    await reload()
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Pending Registrations</h1>
      {loading ? <div>Loading...</div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Room</th>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Name</th>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Phone</th>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Created At</th>
              <th style={{ borderBottom: '1px solid #ccc' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td style={{ padding: '8px 4px' }}>{it.roomNumber}</td>
                <td style={{ padding: '8px 4px' }}>{it.residentName ?? '-'}</td>
                <td style={{ padding: '8px 4px' }}>{it.phone ?? '-'}</td>
                <td style={{ padding: '8px 4px' }}>{new Date(it.createdAt).toLocaleString()}</td>
                <td style={{ padding: '8px 4px' }}>
                  <button onClick={() => approve(it.id)} style={{ marginRight: 8 }}>Approve</button>
                  <button onClick={() => setRejecting(it.id)} style={{ marginRight: 8 }}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {rejecting && (
        <div style={{ marginTop: 16, padding: 12, border: '1px solid #ccc' }}>
          <div>Reject reason for request: {rejecting}</div>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason"
            style={{ width: '100%', margin: '8px 0', padding: 8 }}
          />
          <div>
            <button onClick={() => reject(rejecting)} disabled={!reason}>Confirm Reject</button>
            <button onClick={() => { setRejecting(null); setReason('') }} style={{ marginLeft: 8 }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
