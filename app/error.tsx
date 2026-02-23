'use client'
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  console.error('[UI_FATAL]', error)
  return (
    <html>
      <body>
        <div style={{ padding: 16 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600 }}>เกิดข้อผิดพลาด</h1>
          <p style={{ marginTop: 8 }}>ระบบพบข้อผิดพลาดบนหน้าจอ ERP กรุณาลองใหม่อีกครั้ง หากปัญหายังอยู่โปรดแจ้งผู้ดูแล</p>
          <button onClick={() => reset()} style={{ marginTop: 12, padding: '6px 12px', border: '1px solid var(--border-main)', borderRadius: 4 }}>
            ลองใหม่
          </button>
        </div>
      </body>
    </html>
  )
}
