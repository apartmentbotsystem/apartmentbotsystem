'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'

type SearchItem = {
  number: string
  status: string
  floor: { idx: number } | null
}

export default function GlobalCommandK() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [items, setItems] = useState<SearchItem[]>([])
  const [loading, setLoading] = useState(false)
  const [jobs, setJobs] = useState<Array<{ key: string; name: string; isEnabled: boolean }>>([])

  function getCsrf(): string {
    if (typeof document === 'undefined') return ''
    return document.cookie.split('; ').find((s) => s.startsWith('csrf='))?.split('=')[1] ?? ''
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    void (async () => {
      try {
        const res = await fetch('/api/automation/jobs', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json() as { items: Array<{ key: string; name: string; isEnabled: boolean }> }
        setJobs(json.items ?? [])
      } catch { /* ignore */ }
    })()
  }, [open])

  useEffect(() => {
    if (!open) return
    const text = q.trim()
    if (!text) {
      setItems([])
      return
    }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/rooms/search?q=${encodeURIComponent(text)}`)
        if (!res.ok) return
        const json = await res.json() as { items: SearchItem[] }
        setItems(Array.isArray(json.items) ? json.items : [])
      } finally {
        setLoading(false)
      }
    }, 180)
    return () => clearTimeout(timer)
  }, [open, q])

  const firstRoomPath = useMemo(() => {
    if (!items.length) return ''
    return `/rooms/${encodeURIComponent(items[0]!.number)}`
  }, [items])

  return (
    <>
      <button
        type="button"
        className="chip"
        onClick={() => setOpen(true)}
        aria-label="เปิดการค้นหาทั่วระบบ"
      >
        ค้นหา (⌘K)
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-2xl bg-[var(--bg-page)] border erp-border rounded-xl shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 border-b erp-border">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && firstRoomPath) {
                    e.preventDefault()
                    setOpen(false)
                    router.push(firstRoomPath)
                  }
                }}
                placeholder="ค้นหาหมายเลขห้อง หรือพิมพ์คำสั่ง เช่น 'billing', 'automation', 'dark'"
                className="w-full border erp-border rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="max-h-[50vh] overflow-auto p-2">
              {!q.trim() && (
                <div className="space-y-1 px-2 py-1">
                  <div className="text-xs opacity-70">คำสั่งเร็ว</div>
                  <div className="grid grid-cols-2 gap-1 text-sm">
                    <button className="px-2 py-2 rounded hover:bg-[var(--bg-surface)] text-left" onClick={() => { setOpen(false); router.push('/dashboard') }}>ไป Dashboard</button>
                    <button className="px-2 py-2 rounded hover:bg-[var(--bg-surface)] text-left" onClick={() => { setOpen(false); router.push('/billing') }}>ไป Billing</button>
                    <button className="px-2 py-2 rounded hover:bg-[var(--bg-surface)] text-left" onClick={() => { setOpen(false); router.push('/rooms') }}>ไป Rooms</button>
                    <button className="px-2 py-2 rounded hover:bg-[var(--bg-surface)] text-left" onClick={() => { setOpen(false); router.push('/admin/system/automation') }}>ไป Automation</button>
                    <button className="px-2 py-2 rounded hover:bg-[var(--bg-surface)] text-left" onClick={() => { setOpen(false); setTheme(theme === 'dark' ? 'light' : 'dark') }}>
                      สลับโหมด {theme === 'dark' ? 'Light' : 'Dark'}
                    </button>
                  </div>
                  <div className="text-xs opacity-70 mt-2">Run Job</div>
                  <div>
                    {jobs.map(j => (
                      <button key={j.key} className="block w-full px-2 py-2 rounded hover:bg-[var(--bg-surface)] text-left text-sm"
                        onClick={async () => {
                          setOpen(false)
                          await fetch(`/admin/system/automation/${encodeURIComponent(j.key)}/run`, { method: 'POST', headers: { 'x-csrf-token': getCsrf() } })
                          router.push('/admin/system/automation?tab=history')
                        }}>
                        Run: {j.name} ({j.key})
                      </button>
                    ))}
                  </div>
                  <div className="text-xs opacity-70 mt-2">สร้าง Billing Month</div>
                  <div className="flex items-center gap-2">
                    <input id="cm-y" placeholder="เช่น 2026" className="border erp-border rounded px-2 py-1 text-xs w-28" />
                    <input id="cm-m" placeholder="1-12" className="border erp-border rounded px-2 py-1 text-xs w-20" />
                    <button className="px-2 py-1 border erp-border rounded text-xs" onClick={async () => {
                      const yEl = document.getElementById('cm-y') as HTMLInputElement | null
                      const mEl = document.getElementById('cm-m') as HTMLInputElement | null
                      const year = Number(yEl?.value ?? '')
                      const month = Number(mEl?.value ?? '')
                      if (!Number.isFinite(year) || !Number.isFinite(month)) return
                      await fetch('/api/billing/months/create', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': getCsrf() }, body: JSON.stringify({ year, month }) })
                      setOpen(false)
                      router.push(`/billing?year=${year}&month=${month}`)
                    }}>สร้าง</button>
                  </div>
                  <div className="text-xs opacity-70 mt-2">ค้นหาห้อง พิมพ์หมายเลขเพื่อเริ่ม…</div>
                </div>
              )}
              {loading && <div className="text-xs opacity-70 px-2 py-1">กำลังค้นหา...</div>}
              {!loading && q.trim() && items.length === 0 && <div className="text-xs opacity-70 px-2 py-1">ไม่พบห้อง</div>}
              {items.map((item) => (
                <Link
                  key={item.number}
                  href={`/rooms/${encodeURIComponent(item.number)}`}
                  className="flex items-center justify-between px-2 py-2 rounded hover:bg-[var(--bg-surface)] text-sm"
                  onClick={() => setOpen(false)}
                >
                  <span>{item.number}</span>
                  <span className="text-xs opacity-70">ชั้น {item.floor?.idx ?? '-'} • {item.status}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}


