'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import ChatSendForm from './send-form'

type Msg = { id: string; sender: 'ADMIN' | 'RESIDENT'; text: string; createdAt: string }

export default function ChatPanel({
  conversationId,
  initialMessages,
  replyDisabled,
  disabledReason
}: {
  conversationId: string
  initialMessages: Msg[]
  replyDisabled: boolean
  disabledReason: string
}) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages)
  const box = useRef<HTMLDivElement | null>(null)
  const lastStamp = useMemo(() => messages.length ? messages[messages.length - 1]!.createdAt : '', [messages])

  useEffect(() => {
    const markRead = async () => {
      try {
        await fetch(`/api/admin/conversations/${encodeURIComponent(conversationId)}/read`, { method: 'POST' })
      } catch {}
    }
    markRead()
  }, [conversationId])

  useEffect(() => {
    const el = box.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lastStamp])

  useEffect(() => {
    let es: EventSource | null = null
    let cancelled = false
    try {
      es = new EventSource(`/api/admin/conversations/${encodeURIComponent(conversationId)}/stream`)
      es.addEventListener('messages', (ev) => {
        try {
          const items = JSON.parse((ev as MessageEvent).data) as Array<{ id: string; sender: 'ADMIN' | 'RESIDENT'; text: string; createdAt: string }>
          if (!cancelled && items.length) {
            setMessages((prev) => [...prev, ...items])
          }
        } catch {}
      })
      es.onerror = () => {
        if (es) es.close()
      }
    } catch {
      // fallback: do nothing here (page reload or manual refresh will recover)
    }
    return () => {
      cancelled = true
      if (es) es.close()
    }
  }, [conversationId])

  return (
    <div className="flex flex-col h-full">
      <div ref={box} className="flex-1 overflow-auto p-3 space-y-2">
        {messages.map((m) => (
          <div key={m.id} className={`max-w-[70%] px-3 py-2 rounded border erp-border text-sm ${m.sender === 'ADMIN' ? 'ml-auto bg-[var(--bg-page)]' : 'mr-auto bg-[var(--bg-page)]'}`}>
            <div>{m.text}</div>
            <div className="text-[10px] opacity-60 mt-1">{new Date(m.createdAt).toLocaleString('th-TH')}</div>
          </div>
        ))}
      </div>
      <div className="border-t erp-border p-2">
        <ChatSendForm
          conversationId={conversationId}
          disabled={replyDisabled}
          disabledReason={disabledReason}
          onSent={(text) => {
            const now = new Date().toISOString()
            setMessages((prev) => [...prev, { id: `local-${now}`, sender: 'ADMIN', text, createdAt: now }])
          }}
        />
      </div>
    </div>
  )
}
