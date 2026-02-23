'use client'
import { useEffect, useMemo, useState } from 'react'

type Status = {
  ok: true
  database: { inUseUrl: string | null; configuredInSettings: string | null; source: 'env' | 'settings' | 'none'; connectionOk: boolean }
  line: { token: { inUse: boolean; source: 'env' | 'settings' | 'none' }; secret: { inUse: boolean; source: 'env' | 'settings' | 'none' } }
  webhook: { expected: string | null; configured: string | null; active: boolean; matches: boolean }
}

export default function Wizard() {
  const [s, setS] = useState<Status | null>(null)
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const step = useMemo(() => {
    if (!s) return 1
    if (!s.line.token.inUse || !s.line.secret.inUse) return 1
    if (!s.webhook.matches || !s.webhook.active) return 2
    return 3
  }, [s])

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/system/config/status')
      if (res.ok) {
        const json = await res.json()
        setS(json as Status)
      } else {
        setS(null)
      }
    } finally {
      setLoading(false)
    }
  }

  const test = async () => {
    setTesting(true)
    try {
      await fetch('/api/admin/line/webhook/status', { method: 'POST' })
      await load()
    } finally {
      setTesting(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-3">
      <div className="text-sm">ขั้นตอนการตั้งค่า LINE ใหม่</div>
      <div className="grid gap-2">
        <div className={`p-3 rounded border ${step === 1 ? 'border-[var(--accent-border,#008cba)]' : 'erp-border'}`}>
          <div className="font-semibold mb-1">ขั้นที่ 1: กรอก LINE Channel Token และ LINE Secret</div>
          <div className="text-sm opacity-80">ไปที่ Settings &gt; สภาพแวดล้อมระบบ กรอก Token/Secret แล้วบันทึก ค่าจาก Settings จะถูกใช้งานเป็นหลัก</div>
          <div className="text-xs mt-1">สถานะ: Token {s?.line.token.inUse ? 'พร้อม' : 'ยังไม่พร้อม'} | Secret {s?.line.secret.inUse ? 'พร้อม' : 'ยังไม่พร้อม'}</div>
        </div>
        <div className={`p-3 rounded border ${step === 2 ? 'border-[var(--accent-border,#008cba)]' : 'erp-border'}`}>
          <div className="font-semibold mb-1">ขั้นที่ 2: ตั้งค่า Webhook ใน LINE Developers</div>
          <div className="text-sm opacity-80">คัดลอก URL ด้านล่างไปตั้งใน LINE Developers:</div>
          <div className="text-xs mt-1">{s?.webhook.expected ?? '-'}</div>
          <div className="text-xs mt-1">Configured: {s?.webhook.configured ?? '-'}</div>
          <div className="text-xs mt-1">Active: {s?.webhook.active ? 'เปิด' : 'ปิด'} | Matches: {s?.webhook.matches ? 'ตรง' : 'ไม่ตรง'}</div>
        </div>
        <div className={`p-3 rounded border ${step === 3 ? 'border-[var(--accent-border,#008cba)]' : 'erp-border'}`}>
          <div className="font-semibold mb-1">ขั้นที่ 3: ทดสอบ Webhook</div>
          <div className="text-sm opacity-80">กดปุ่มด้านล่างเพื่อส่งทดสอบจาก LINE</div>
          <button type="button" onClick={test} disabled={testing} className="mt-2 px-2 py-1 border erp-border rounded text-sm disabled:opacity-60">
            {testing ? 'กำลังทดสอบ...' : 'ทดสอบส่ง Webhook'}
          </button>
        </div>
      </div>
      <div>
        <button type="button" onClick={load} disabled={loading} className="px-2 py-1 border erp-border rounded text-sm disabled:opacity-60">
          {loading ? 'กำลังโหลด...' : 'รีเฟรชสถานะ'}
        </button>
      </div>
    </div>
  )
}

