'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type Role = 'ADMIN' | 'STAFF' | null

type RegistrationItem = {
  id: string
  lineUserId: string
  room: { id: string; roomNumber: string } | null
  tenant: { id: string; name: string } | null
  createdAt: string
}

async function fetchAny<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.headers || {}), accept: 'application/vnd.apartment.v1.1+json' },
    cache: 'no-store',
  })
  const json = await res.json().catch(() => null)
  if (json && typeof json === 'object' && 'success' in json) {
    if (json.success) return json.data as T
    const message = (json.error && json.error.message) || 'Error'
    throw new Error(String(message))
  }
  return json as T
}

export default function PendingRegistrationsPage() {
  const [role, setRole] = useState<Role>(null)
  const [items, setItems] = useState<RegistrationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [actError, setActError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalRegId, setModalRegId] = useState<string | null>(null)
  const [availableRooms, setAvailableRooms] = useState<Array<{ id: string; roomNumber: string }>>([])
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)

  const canView = useMemo(() => role === 'ADMIN', [role])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sess = await fetchAny<{ userId: string | null; role: 'ADMIN' | 'STAFF' | null }>('/api/auth/session')
      setRole(sess?.role ?? null)
      const data = await fetchAny<RegistrationItem[]>('/api/admin/tenant-registrations')
      setItems(Array.isArray(data) ? data : [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function openApproveModal(id: string) {
    setModalRegId(id)
    setSelectedRoomId(null)
    setModalOpen(true)
    try {
      const rooms = await fetchAny<Array<{ id: string; roomNumber: string; status: string }>>('/api/admin/rooms?status=AVAILABLE')
      setAvailableRooms(rooms.map((r) => ({ id: r.id, roomNumber: r.roomNumber })))
    } catch {
      setAvailableRooms([])
    }
  }

  async function confirmApprove() {
    if (!modalRegId || !selectedRoomId) return
    setActingId(modalRegId)
    setActError(null)
    try {
      await fetchAny(`/api/admin/tenant-registrations/${encodeURIComponent(modalRegId)}/approve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roomId: selectedRoomId }),
      })
      setModalOpen(false)
      setModalRegId(null)
      await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setActError(msg)
    } finally {
      setActingId(null)
    }
  }

  async function doReject(id: string) {
    if (!window.confirm('ยืนยันปฏิเสธการสมัครนี้หรือไม่?')) return
    setActingId(id)
    setActError(null)
    try {
      await fetchAny(`/api/admin/tenant-registrations/${encodeURIComponent(id)}/reject`, { method: 'POST' })
      await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setActError(msg)
    } finally {
      setActingId(null)
    }
  }

  if (!canView) {
    return <div className="p-4 text-red-600">ต้องเป็น Admin เท่านั้น</div>
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="font-semibold text-lg">Pending Tenant Registrations</h2>
      {error ? <div className="text-red-600">{error}</div> : null}
      {actError ? <div className="text-red-600">{actError}</div> : null}
      {loading ? <div>กำลังโหลด...</div> : null}
      <table className="w-full border border-slate-300">
        <thead className="bg-slate-100">
          <tr>
            <th className="text-left p-2 border-b">LINE User</th>
            <th className="text-left p-2 border-b">Room</th>
            <th className="text-left p-2 border-b">สมัครเมื่อ</th>
            <th className="text-left p-2 border-b">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-b">
              <td className="p-2">{it.lineUserId}</td>
              <td className="p-2">{it.room ? it.room.roomNumber : '-'}</td>
              <td className="p-2">{new Date(it.createdAt).toLocaleString()}</td>
              <td className="p-2 space-x-2">
                <button
                  className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-50"
                  onClick={() => openApproveModal(it.id)}
                  disabled={actingId === it.id}
                >
                  Approve
                </button>
                <button
                  className="px-3 py-1 rounded bg-red-600 text-white disabled:opacity-50"
                  onClick={() => doReject(it.id)}
                  disabled={actingId === it.id}
                >
                  Reject
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {modalOpen ? (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded shadow p-4 w-[420px]">
            <h3 className="font-semibold mb-3">เลือกห้องสำหรับการอนุมัติ</h3>
            <div className="mb-3">
              <select
                className="w-full border rounded p-2"
                value={selectedRoomId ?? ''}
                onChange={(e) => setSelectedRoomId(e.target.value || null)}
              >
                <option value="">-- เลือกห้องว่าง --</option>
                {availableRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.roomNumber}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1 rounded bg-slate-200" onClick={() => setModalOpen(false)}>
                ยกเลิก
              </button>
              <button
                className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-50"
                onClick={confirmApprove}
                disabled={!selectedRoomId || actingId === modalRegId}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
