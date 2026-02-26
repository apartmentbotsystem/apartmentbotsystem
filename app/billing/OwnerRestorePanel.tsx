'use client'

import { useMemo, useState } from 'react'
import { compareRoomNumbersNatural } from '@/lib/room-sort'

type VersionItem = {
  id: string
  roomNumber: string
  versionNo: number
  isActive: boolean
  createdAt: string
}

export default function OwnerRestorePanel({
  billingMonthId,
  versions
}: {
  billingMonthId: string
  versions: VersionItem[]
}) {
  const roomOptions = useMemo(
    () => Array.from(new Set(versions.map((v) => v.roomNumber))).sort(compareRoomNumbersNatural),
    [versions]
  )
  const [roomNumber, setRoomNumber] = useState(roomOptions[0] ?? '')
  const [targetVersionId, setTargetVersionId] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string>('')

  const roomVersions = useMemo(
    () => versions.filter((v) => v.roomNumber === roomNumber),
    [versions, roomNumber]
  )

  const submit = async () => {
    if (!roomNumber || !targetVersionId) return
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch(`/api/admin/billing/${encodeURIComponent(roomNumber)}/${encodeURIComponent(billingMonthId)}/revert`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetVersionId, reason: reason.trim() || undefined })
      })
      const json = await res.json()
      if (!res.ok) {
        setMessage(json?.message ?? json?.error ?? 'Restore failed')
        return
      }
      setMessage('Restore success')
      location.reload()
    } catch {
      setMessage('Restore failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="border erp-border rounded p-3 space-y-2">
      <div className="font-semibold">Owner Restore Billing Version</div>
      <div className="grid gap-2 md:grid-cols-3 text-sm">
        <select
          value={roomNumber}
          onChange={(e) => {
            const nextRoom = e.target.value
            setRoomNumber(nextRoom)
            setTargetVersionId('')
          }}
          className="border erp-border rounded px-2 py-1"
        >
          {roomOptions.map((room) => (
            <option key={room} value={room}>{room}</option>
          ))}
        </select>
        <select
          value={targetVersionId}
          onChange={(e) => setTargetVersionId(e.target.value)}
          className="border erp-border rounded px-2 py-1"
        >
          <option value="">Select target version</option>
          {roomVersions.map((v) => (
            <option key={v.id} value={v.id}>
              v{v.versionNo} {v.isActive ? '(Active)' : ''} - {new Date(v.createdAt).toISOString().slice(0, 10)}
            </option>
          ))}
        </select>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional)"
          className="border erp-border rounded px-2 py-1"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy || !targetVersionId}
          onClick={submit}
          className="px-2 py-1 border erp-border rounded text-sm disabled:opacity-50"
        >
          {busy ? 'Restoring...' : 'Restore Version'}
        </button>
        {message && <span className="text-xs">{message}</span>}
      </div>
    </section>
  )
}
