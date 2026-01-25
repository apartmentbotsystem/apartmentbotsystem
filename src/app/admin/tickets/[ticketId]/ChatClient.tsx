'use client'

import { useEffect, useRef, useState } from "react"
import ChatBubble from "./ChatBubble"
import ChatInput from "./ChatInput"

function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}

export default function ChatClient({
  initialMessages,
  ticketId,
}: {
  initialMessages: Array<{ id: string; direction: "INBOUND" | "OUTBOUND"; messageText: string; createdAt: string }>
  ticketId: string
}) {
  const [messages, setMessages] = useState(initialMessages)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" })
  }, [messages])
  async function send(text: string) {
    const optimistic = {
      id: `temp-${Date.now()}`,
      direction: "OUTBOUND" as const,
      messageText: text,
      createdAt: new Date().toISOString(),
    }
    setMessages((m) => [...m, optimistic])
    await fetch(`/api/admin/tickets/${ticketId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageText: text }),
    })
  }
  return (
    <div className="flex flex-col h-full">
      <div ref={ref} className="flex-1 overflow-y-auto p-3">
        {messages.map((m) => (
          <ChatBubble key={m.id} direction={m.direction} text={m.messageText} time={formatTime(new Date(m.createdAt))} />
        ))}
      </div>
      <ChatInput onSend={send} />
    </div>
  )
}
