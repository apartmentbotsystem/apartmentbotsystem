"use client"

import { useEffect, useMemo, useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase/browser'

type ConversationItem = {
  id: string
  lineUserId: string
  displayName: string
  unreadAdmin: number
  lastMessageAt: string
  lastMessage: string | null
  roomNumber: string | null
}

type Message = {
  id: string
  sender: 'ADMIN' | 'RESIDENT'
  text: string
  createdAt: string
}

export default function InboxPage() {
  const [items, setItems] = useState<ConversationItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')

  async function loadConversations() {
    const res = await fetch('/api/admin/conversations', { cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json()
    setItems(data.items ?? [])
    if (!activeId && (data.items?.length ?? 0) > 0) {
      setActiveId(data.items[0].id)
    }
  }
  async function loadMessages(id: string) {
    const res = await fetch(`/api/admin/conversations/${id}/messages`, { cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json()
    setMessages(data.items ?? [])
  }
  useEffect(() => { loadConversations() }, [])
  useEffect(() => { if (activeId) { loadMessages(activeId) } }, [activeId])

  useEffect(() => {
    let channel: any | null = null
    try {
      const supabase = getSupabaseBrowser()
      channel = supabase
      .channel('chat-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat',
          ...(activeId ? { filter: `conversation_id=eq.${activeId}` } : {})
        },
        (payload: any) => {
          const row = payload?.new ?? {}
          const conversationId = String(row.conversation_id ?? '')
          if (activeId && conversationId && conversationId !== activeId) return
          const msg: Message = {
            id: String(row.id ?? `rt-${Date.now()}`),
            sender: (row.sender ?? 'RESIDENT') as 'ADMIN' | 'RESIDENT',
            text: String(row.text ?? row.message ?? ''),
            createdAt: String(row.created_at ?? new Date().toISOString())
          }
          setMessages(prev => [...prev, msg])
        }
      )
      .subscribe()
    } catch {
      // ignore on SSR/build or missing env
    }
    return () => {
      try {
        if (channel) {
          const supabase = getSupabaseBrowser()
          supabase.removeChannel(channel)
        }
      } catch {
        // ignore
      }
    }
  }, [activeId])

  async function send() {
    if (!activeId || !input.trim()) return
    await fetch(`/api/admin/conversations/${activeId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: input })
    })
    const now = new Date().toISOString()
    setMessages(m => [...m, { id: `tmp-${now}`, sender: 'ADMIN', text: input, createdAt: now }])
    setInput('')
    await loadConversations()
  }

  async function markRead(id: string) {
    await fetch(`/api/admin/conversations/${id}/read`, { method: 'POST' })
    await loadConversations()
  }

  const active = useMemo(() => items.find(i => i.id === activeId) ?? null, [items, activeId])

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 40px)' }}>
      <div style={{ width: 300, borderRight: '1px solid #ddd', padding: 10, overflowY: 'auto' }}>
        <h3>Inbox</h3>
        {items.map(i => (
          <div key={i.id}
               onClick={() => { setActiveId(i.id); markRead(i.id) }}
               style={{ padding: 8, cursor: 'pointer', background: activeId === i.id ? '#eef' : 'transparent', borderRadius: 4, marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>{i.displayName}</div>
              {i.unreadAdmin > 0 && <span style={{ background: 'red', color: 'white', borderRadius: 10, padding: '2px 6px', fontSize: 12 }}>{i.unreadAdmin}</span>}
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>{i.lastMessage ?? ''}</div>
            <div style={{ fontSize: 11, color: '#999' }}>{new Date(i.lastMessageAt).toLocaleString()}</div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, padding: 10, display: 'flex', flexDirection: 'column' }}>
        <div style={{ borderBottom: '1px solid #ddd', paddingBottom: 6, marginBottom: 6 }}>
          <strong>{active?.displayName ?? 'Select conversation'}</strong>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 10, background: '#fafafa' }}>
          {messages.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: m.sender === 'ADMIN' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
              <div style={{
                maxWidth: '70%',
                padding: 8,
                borderRadius: 8,
                background: m.sender === 'ADMIN' ? '#d0e6ff' : '#fff',
                border: '1px solid #ddd'
              }}>
                <div style={{ fontSize: 12, color: '#666' }}>{new Date(m.createdAt).toLocaleString()}</div>
                <div>{m.text}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', marginTop: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="พิมพ์ข้อความ..." style={{ flex: 1, padding: 8, marginRight: 8 }} />
          <button onClick={send}>Send</button>
        </div>
      </div>
      <div style={{ width: 280, borderLeft: '1px solid #ddd', padding: 10 }}>
        <h3>รายละเอียด</h3>
        {active ? (
          <>
            <div><strong>Line User ID</strong><br />{active.lineUserId}</div>
            <div style={{ marginTop: 8 }}><strong>Room</strong><br />{active.roomNumber ?? '-'}</div>
          </>
        ) : (
          <div>เลือกแชทจากด้านซ้าย</div>
        )}
      </div>
    </div>
  )
}
