﻿﻿﻿﻿﻿﻿﻿﻿﻿'use client'
import { useState } from 'react'

export default function CreateTicketButton({ roomNumber, residentId }: { roomNumber: string; residentId?: string }) {
  const [busy, setBusy] = useState(false)

  const onClick = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomNumber, ...(residentId ? { residentId } : {}), text: 'Created from LINE conversation' })
      })
      const json = await res.json()
      if (!res.ok || !json.id) {
        alert('สร้างทิกเก็ตไม่สำเร็จ')
      } else {
        alert('สร้างทิกเก็ตแล้ว')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <button onClick={onClick} disabled={busy} className="px-2 py-1 border erp-border rounded text-xs">
      สร้างทิกเก็ต
    </button>
  )
}

