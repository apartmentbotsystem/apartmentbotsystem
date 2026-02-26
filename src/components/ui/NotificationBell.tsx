"use client"
import React from 'react'

export default function NotificationBell() {
  return (
    <button aria-label="Notifications" className="relative p-2 rounded hover:bg-[var(--bg-soft)]">
      <span aria-hidden>🔔</span>
    </button>
  )
}
