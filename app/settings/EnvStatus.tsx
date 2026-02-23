'use client'
import { useEffect, useState } from 'react'

type Status = {
  ok: true
  database: { inUseUrl: string | null; configuredInSettings: string | null; source: 'env' | 'settings' | 'none'; connectionOk: boolean }
  line: { token: { inUse: boolean; source: 'env' | 'settings' | 'none' }; secret: { inUse: boolean; source: 'env' | 'settings' | 'none' } }
  webhook: { expected: string | null; configured: string | null; active: boolean; matches: boolean }
}

export default function EnvStatus() {
  const [s, setS] = useState<Status | null>(null)
  const [loading, setLoading] = useState(false)

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

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={load} disabled={loading} className="px-2 py-1 border erp-border rounded text-sm disabled:opacity-60">
          {loading ? 'กำลังโหลด...' : 'รีเฟรชสถานะ'}
        </button>
      </div>
      {s && (
        <div className="grid md:grid-cols-3 gap-2 text-sm">
          <div className="border erp-border rounded p-2">
            <div className="font-semibold mb-1">Database</div>
            <div>ใช้งานจาก: {s.database.source}</div>
            <div>In use URL: {s.database.inUseUrl ?? '-'}</div>
            <div>Configured (Settings): {s.database.configuredInSettings ?? '-'}</div>
            <div>เชื่อมต่อ: {s.database.connectionOk ? 'ใช้งานได้' : 'ล้มเหลว'}</div>
          </div>
          <div className="border erp-border rounded p-2">
            <div className="font-semibold mb-1">LINE Token/Secret</div>
            <div>Token ใช้งานจาก: {s.line.token.source}</div>
            <div>Secret ใช้งานจาก: {s.line.secret.source}</div>
          </div>
          <div className="border erp-border rounded p-2">
            <div className="font-semibold mb-1">Webhook</div>
            <div>Expected: {s.webhook.expected ?? '-'}</div>
            <div>Configured: {s.webhook.configured ?? '-'}</div>
            <div>Active: {s.webhook.active ? 'เปิด' : 'ปิด'}</div>
            <div>Matches: {s.webhook.matches ? 'ตรง' : 'ไม่ตรง'}</div>
          </div>
        </div>
      )}
    </div>
  )
}

