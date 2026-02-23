'use client'

import { useMemo, useState } from 'react'

type VacantRoom = {
  roomNumber: string
  floorIdx: number | null
}

type Props = {
  rooms: VacantRoom[]
}

export default function MoveInWizard({ rooms }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [floorFilter, setFloorFilter] = useState<string>('ALL')
  const [roomNumber, setRoomNumber] = useState('')
  const [primaryName, setPrimaryName] = useState('')
  const [resident2Name, setResident2Name] = useState('')
  const [lineId, setLineId] = useState('')
  const [deposit, setDeposit] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const floors = useMemo(() => {
    const all = new Set<number>()
    for (const room of rooms) {
      if (typeof room.floorIdx === 'number') all.add(room.floorIdx)
    }
    return Array.from(all).sort((a, b) => a - b)
  }, [rooms])

  const filteredRooms = useMemo(() => {
    if (floorFilter === 'ALL') return rooms
    return rooms.filter((room) => String(room.floorIdx ?? '') === floorFilter)
  }, [floorFilter, rooms])

  const canNext1 = roomNumber.length > 0
  const canNext2 = primaryName.trim().length > 0 && startDate.length > 0

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/occupancy/move-in', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          roomNumber,
          primaryName,
          resident2Name,
          lineId,
          deposit,
          startDate,
          note
        })
      })
      const json = await res.json()
      if (!res.ok || !json?.ok) {
        setError(json?.message ?? json?.error ?? 'Move in failed')
        return
      }
      location.reload()
    } catch {
      setError('Move in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="border erp-border rounded p-3 space-y-3">
      <h2 className="font-semibold">Move In Wizard</h2>
      <div className="flex items-center gap-2 text-xs">
        <span className={`chip ${step === 1 ? 'font-semibold' : ''}`}>Step 1: Select Room</span>
        <span className={`chip ${step === 2 ? 'font-semibold' : ''}`}>Step 2: Tenant Info</span>
        <span className={`chip ${step === 3 ? 'font-semibold' : ''}`}>Step 3: Confirm</span>
      </div>

      {step === 1 && (
        <div className="space-y-2 text-sm">
          <div className="flex gap-2 items-center">
            <label>Floor</label>
            <select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)} className="border erp-border rounded px-2 py-1">
              <option value="ALL">All</option>
              {floors.map((f) => (
                <option key={f} value={String(f)}>Floor {f}</option>
              ))}
            </select>
          </div>
          <select value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} className="border erp-border rounded px-2 py-1 w-full" required>
            <option value="">Select vacant room</option>
            {filteredRooms.map((r) => (
              <option key={r.roomNumber} value={r.roomNumber}>{r.roomNumber} (Floor {r.floorIdx ?? '-'})</option>
            ))}
          </select>
          <div>
            <button type="button" disabled={!canNext1} onClick={() => setStep(2)} className="px-3 py-1 border erp-border rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-2 md:grid-cols-2 text-sm">
          <input value={primaryName} onChange={(e) => setPrimaryName(e.target.value)} placeholder="Primary Tenant (required)" className="border erp-border rounded px-2 py-1" required />
          <input value={resident2Name} onChange={(e) => setResident2Name(e.target.value)} placeholder="Resident 2 (optional)" className="border erp-border rounded px-2 py-1" />
          <input value={lineId} onChange={(e) => setLineId(e.target.value)} placeholder="LINE ID (optional)" className="border erp-border rounded px-2 py-1" />
          <input value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="Deposit (optional)" type="number" step="0.01" className="border erp-border rounded px-2 py-1" />
          <input value={startDate} onChange={(e) => setStartDate(e.target.value)} type="date" className="border erp-border rounded px-2 py-1" required />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" className="border erp-border rounded px-2 py-1" />
          <div className="md:col-span-2 flex gap-2">
            <button type="button" onClick={() => setStep(1)} className="px-3 py-1 border erp-border rounded">Back</button>
            <button type="button" disabled={!canNext2} onClick={() => setStep(3)} className="px-3 py-1 border erp-border rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-2 text-sm">
          <div className="border erp-border rounded p-2 space-y-1">
            <div>Room: <strong>{roomNumber}</strong></div>
            <div>Primary: <strong>{primaryName || '-'}</strong></div>
            <div>Resident 2: <strong>{resident2Name || '-'}</strong></div>
            <div>LINE ID: <strong>{lineId || '-'}</strong></div>
            <div>Deposit: <strong>{deposit || '-'}</strong></div>
            <div>Start Date: <strong>{startDate || '-'}</strong></div>
            <div>Note: <strong>{note || '-'}</strong></div>
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(2)} className="px-3 py-1 border erp-border rounded">Back</button>
            <button type="button" onClick={submit} disabled={busy} className="px-3 py-1 border erp-border rounded disabled:opacity-50">{busy ? 'Saving...' : 'Confirm Move In'}</button>
          </div>
        </div>
      )}
    </section>
  )
}
