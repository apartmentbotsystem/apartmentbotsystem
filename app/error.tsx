"use client"
import React, { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    const payload = {
      message: error.message,
      stack: error.stack,
      path: typeof window !== 'undefined' ? window.location.pathname : undefined,
      ts: new Date().toISOString()
    }
    // Best-effort logging; ignore failures
    void fetch('/api/logs/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  }, [error])
  return (
    <html>
      <body>
        <main className="container">
          <h1>เกิดข้อผิดพลาด</h1>
          <p>ระบบพบข้อผิดพลาดที่ไม่คาดคิด</p>
          <button onClick={reset}>ลองอีกครั้ง</button>
        </main>
      </body>
    </html>
  )
}

