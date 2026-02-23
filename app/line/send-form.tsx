'use client'
import { useState } from 'react'

export default function ChatSendForm({
  conversationId,
  disabled = false,
  disabledReason = '',
  onSent
}: {
  conversationId: string
  disabled?: boolean
  disabledReason?: string
  onSent?: (text: string) => void
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const send = async () => {
    if (disabled) return
    if (!text.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/conversations/${encodeURIComponent(conversationId)}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text })
      })
      if (res.ok) {
        setText('')
        if (onSent) onSent(text)
        else location.reload()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="พิมพ์ข้อความ..."
        disabled={disabled || busy}
        className="border erp-border rounded px-2 py-1 text-sm flex-1 disabled:opacity-60"
      />
      <button onClick={send} disabled={busy || disabled} className="px-2 py-1 border erp-border rounded text-sm disabled:opacity-60">
        ส่ง
      </button>
      </div>
      {disabled && <div className="text-xs text-red-600">{disabledReason || 'ปิดการตอบกลับ'}</div>}
    </div>
  )
}

