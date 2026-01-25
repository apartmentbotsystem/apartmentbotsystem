'use client'

import { useState } from "react"

type Props = {
  onSend: (text: string) => Promise<void> | void
}

export default function ChatInput({ onSend }: Props) {
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    setSending(true)
    try {
      await onSend(t)
      setText("")
    } finally {
      setSending(false)
    }
  }
  return (
    <form onSubmit={submit} className="w-full flex gap-2 p-2 border-t border-gray-200">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="flex-1 resize-none border rounded-lg p-2 focus:outline-none focus:ring"
        rows={2}
        placeholder="พิมพ์ตอบ..."
      />
      <button
        type="submit"
        disabled={sending || text.trim().length === 0}
        className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
      >
        ส่ง
      </button>
    </form>
  )
}
