"use client"
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

type Toast = { id: number; type: 'success' | 'error'; message: string }

type ToastContextValue = {
  showSuccess: (message: string) => void
  showError: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('ToastProvider missing')
  return ctx
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((type: 'success' | 'error', message: string) => {
    setToasts((prev) => [...prev, { id: Date.now() + Math.random(), type, message }])
  }, [])
  const showSuccess = useCallback((message: string) => push('success', message), [push])
  const showError = useCallback((message: string) => push('error', message), [push])

  useEffect(() => {
    const t = setInterval(() => {
      setToasts(prev => prev.slice(1))
    }, 3000)
    return () => clearInterval(t)
  }, [])

  return (
    <ToastContext.Provider value={{ showSuccess, showError }}>
      {children}
      <div style={containerStyle} aria-live="polite" aria-atomic="true">
        {toasts.map(t => (
          <div key={t.id} style={{ ...toastStyle, background: t.type === 'success' ? '#0a0' : '#c00' }}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  right: 16,
  bottom: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  zIndex: 2000
}

const toastStyle: React.CSSProperties = {
  color: '#fff',
  padding: '8px 12px',
  borderRadius: 4,
  boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
}

