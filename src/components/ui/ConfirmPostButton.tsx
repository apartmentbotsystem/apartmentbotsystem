"use client"
import React, { useState } from 'react'

type Props = {
  onConfirm?: () => Promise<void> | void
  confirmMessage?: string
  title?: string
  description?: string
  url?: string
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  json?: unknown
  successMessage?: string
  reload?: boolean
  action?: string
  fields?: Record<string, string>
  confirmTitle?: string
  confirmDescription?: string
  destructive?: boolean
  children?: React.ReactNode
  className?: string
  disabled?: boolean
}

function ConfirmActionButtonImpl(props: Props) {
  const { onConfirm, confirmMessage, title, description, url, method = 'POST', json, reload, action, fields, confirmTitle, confirmDescription, destructive, children, className, disabled } = props
  const [loading, setLoading] = useState(false)
  async function handleClick() {
    if (disabled || loading) return
    const msg = confirmMessage || confirmTitle || title || 'Are you sure?'
    const ok = typeof window !== 'undefined' ? window.confirm(msg) : true
    if (!ok) return
    try {
      setLoading(true)
      if (typeof onConfirm === 'function') {
        await onConfirm()
      } else if (url || action) {
        const target = url ?? action!
        const bodyPayload = (() => {
          if (json != null) return json
          if (fields) {
            const obj: Record<string, unknown> = {}
            for (const [k, v] of Object.entries(fields)) {
              if (v === 'true') obj[k] = true
              else if (v === 'false') obj[k] = false
              else if (/^\d+(\.\d+)?$/.test(v)) obj[k] = Number(v)
              else obj[k] = v
            }
            return obj
          }
          return undefined
        })()
        const res = await fetch(target, {
          method,
          headers: bodyPayload != null ? { 'Content-Type': 'application/json' } : undefined,
          body: bodyPayload != null ? JSON.stringify(bodyPayload) : undefined
        })
        if (!res.ok) {
          // no-op; consumer can handle errors outside
        }
        if (reload && typeof window !== 'undefined') {
          window.location.reload()
        }
      }
    } finally {
      setLoading(false)
    }
  }
  return (
    <button onClick={handleClick} className={`${destructive ? 'bg-rose-600 text-white hover:bg-rose-700' : ''} ${className ?? ''}`} disabled={disabled || loading}>
      {children}
    </button>
  )
}

export const ConfirmActionButton = ConfirmActionButtonImpl
export default ConfirmActionButtonImpl
