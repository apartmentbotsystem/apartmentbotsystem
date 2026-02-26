"use client"
import { useEffect, useState } from 'react'
import { toDisplayZoned } from '@/lib/time'
import PageHeader from '@/components/system/PageHeader'
import PageContainer from '@/components/system/PageContainer'
import ErrorPanel from '@/components/system/ErrorPanel'
import Button from '@/components/ui/Button'

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
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    setLoading(true); setError(null)
    try {
      const list = await fetchPending()
      setItems(list)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
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
    <PageContainer>
      <PageHeader title="Pending Registrations" />
      <div className="space-y-3 mt-4">
        {error ? <ErrorPanel message={error} /> : null}
        {loading ? (
          <div className="text-sm opacity-70">Loading...</div>
        ) : (
          <div className="overflow-auto border erp-border rounded">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="[&>th]:px-2 [&>th]:py-2 border-b erp-border text-left bg-[var(--bg-page)]">
                  <th>Room</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Created At</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.id} className="[&>td]:px-2 [&>td]:py-1 border-b erp-border">
                    <td>{it.roomNumber}</td>
                    <td>{it.residentName ?? '-'}</td>
                    <td>{it.phone ?? '-'}</td>
                    <td>{toDisplayZoned(it.createdAt)}</td>
                    <td className="text-right">
                      <Button size="sm" className="mr-2" onClick={() => approve(it.id)}>Approve</Button>
                      <Button size="sm" variant="secondary" onClick={() => setRejecting(it.id)}>Reject</Button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={5} className="px-2 py-6 text-center opacity-70">ไม่มีคำขอคงค้าง</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {rejecting && (
          <div className="p-3 border erp-border rounded">
            <div className="text-sm">Reject reason for request: <span className="font-mono">{rejecting}</span></div>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Reason"
              className="border erp-border rounded px-2 py-1 w-full mt-2"
            />
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="destructive" onClick={() => reject(rejecting)} disabled={!reason}>Confirm Reject</Button>
              <Button size="sm" variant="ghost" onClick={() => { setRejecting(null); setReason('') }}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  )
}
