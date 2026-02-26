"use client"
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'
type Toast = { id: number; type: ToastType; message: string; timeout: number }

type ToastContextValue = {
  showSuccess: (message: string) => void
  showError: (message: string) => void
  showInfo: (message: string) => void
  showWarning: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('ToastProvider missing')
  return ctx
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const lastShownRef = useRef<Map<string, number>>(new Map())
  const push = useCallback((type: ToastType, message: string, timeout = 5000) => {
    const key = `${type}:${message}`
    const now = Date.now()
    const last = lastShownRef.current.get(key) ?? 0
    if (now - last < 500) {
      return
    }
    lastShownRef.current.set(key, now)
    setToasts((prev) => [...prev, { id: now + Math.random(), type, message, timeout }])
  }, [])
  const showSuccess = useCallback((message: string) => push('success', message), [push])
  const showError = useCallback((message: string) => push('error', message), [push])
  const showInfo = useCallback((message: string) => push('info', message), [push])
  const showWarning = useCallback((message: string) => push('warning', message), [push])

  useEffect(() => {
    if (toasts.length === 0) return
    const timers = toasts.map((t) =>
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id))
      }, t.timeout)
    )
    return () => timers.forEach(clearTimeout)
  }, [toasts])

  function ToastItem({ t, onClose }: { t: Toast; onClose: () => void }) {
    const [entered, setEntered] = useState(false)
    useEffect(() => {
      const r = requestAnimationFrame(() => setEntered(true))
      return () => cancelAnimationFrame(r)
    }, [])
    const bg =
      t.type === 'success'
        ? 'bg-emerald-600'
        : t.type === 'error'
        ? 'bg-rose-600'
        : t.type === 'warning'
        ? 'bg-amber-600'
        : 'bg-blue-600'
    return (
      <div
        role="alert"
        className={`text-white rounded-lg shadow-lg px-3 py-2 min-w-[260px] flex items-start justify-between gap-3 transform transition-all duration-150 ease-out ${entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} ${bg}`}
      >
        <div className="text-sm">{t.message}</div>
        <button aria-label="Dismiss" className="opacity-80 hover:opacity-100" onClick={onClose}>
          ×
        </button>
      </div>
    )
  }

  return (
    <ToastContext.Provider value={{ showSuccess, showError, showInfo, showWarning }}>
      {children}
      <div className="fixed top-4 right-4 z-[2000] flex flex-col gap-2" aria-live="polite" aria-atomic="true">
        {toasts.map(t => (
          <ToastItem key={t.id} t={t} onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
