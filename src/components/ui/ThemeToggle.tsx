"use client"
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      aria-label="สลับธีม"
      className="text-sm px-2 py-1 border rounded erp-border"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? 'โหมดสว่าง' : 'โหมดมืด'}
    </button>
  )
}

