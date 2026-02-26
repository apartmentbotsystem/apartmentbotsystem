'use client'
import { useState } from 'react'

type Status = {
  ok: true
  tokenConfigured: boolean
  expected: string | null
  configured: string | null
  active: boolean
  matches: boolean
}

export default function LineWebhookStatus() {
  const [status, setStatus] = useState<Status | null>(null)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<string>('')

  const load = async () => {
    setMessage('')
    const res = await fetch('/api/admin/line/webhook/status')
    if (res.ok) {
      const json = (await res.json()) as Status
      setStatus(json)
    } else {
      setStatus(null)
    }
  }

  const test = async () => {
    setTesting(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/line/webhook/status', { method: 'POST' })
      const json = await res.json()
      if (res.ok && (json as { ok?: boolean }).ok) {
        setMessage('ส่งคำสั่งทดสอบไปยัง LINE สำเร็จ กรุณาดูผลในคอนโซล LINE')
      } else {
        setMessage('ทดสอบไม่สำเร็จ โปรดตรวจสอบ Token และ Endpoint ใน LINE Developers')
      }
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={load} className="px-2 py-1 border erp-border rounded text-sm">ตรวจสอบสถานะ</button>
        <button type="button" onClick={test} disabled={testing} className="px-2 py-1 border erp-border rounded text-sm disabled:opacity-60">
          {testing ? 'กำลังทดสอบ...' : 'ทดสอบส่ง Webhook'}
        </button>
      </div>
      {message && <div className="text-sm">{message}</div>}
      {status && (
        <div className="text-sm border erp-border rounded p-2">
          <div>Token: {status.tokenConfigured ? 'พร้อมใช้งาน' : 'ไม่พบ/ไม่ถูกต้อง'}</div>
          <div>Expected Endpoint: {status.expected ?? '-'}</div>
          <div>Configured in LINE: {status.configured ?? '-'}</div>
          <div>Active (LINE): {status.active ? 'เปิดใช้งาน' : 'ปิด'}</div>
          <div>Matches: {status.matches ? 'ตรง' : 'ไม่ตรง'}</div>
        </div>
      )}
    </div>
  )
}

