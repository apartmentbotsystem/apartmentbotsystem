'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type SearchItem = {
  number: string
  status: string
  floor: { idx: number } | null
}

export default function GlobalCommandK() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [items, setItems] = useState<SearchItem[]>([])
  const [loading, setLoading] = useState(false)

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
                placeholder="ค้นหาหมายเลขห้อง..."
                className="w-full border erp-border rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="max-h-[50vh] overflow-auto p-2">
              {!q.trim() && <div className="text-xs opacity-70 px-2 py-1">พิมพ์หมายเลขห้อง เช่น 798/1</div>}
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


