"use client"
import { useEffect, useRef } from 'react'

export default function GridEnhancer() {
  const ref = useRef<HTMLFormElement | null>(null)
  useEffect(() => {
    const form = ref.current ?? (document.currentScript?.parentElement as HTMLFormElement | null)
    const targetForm = form ?? (document.querySelector('[data-grid-form]') as HTMLFormElement | null)
    if (!targetForm) return
    const inputs = Array.from(targetForm.querySelectorAll('input'))
    const submit = () => {
      targetForm.requestSubmit()
    }
    const onBlur = (e: Event) => {
      const t = e.target as HTMLElement
      if (t && (t as HTMLInputElement).name) submit()
    }
    const onKey = (e: KeyboardEvent) => {
      const idx = inputs.indexOf(e.target as HTMLInputElement)
      if (e.key === 'Enter') {
        e.preventDefault()
        submit()
      } else if (e.key === 'ArrowRight' && idx >= 0) {
        e.preventDefault()
        inputs[Math.min(inputs.length - 1, idx + 1)]?.focus()
      } else if (e.key === 'ArrowLeft' && idx >= 0) {
        e.preventDefault()
        inputs[Math.max(0, idx - 1)]?.focus()
      }
    }
    inputs.forEach(i => {
      i.addEventListener('blur', onBlur)
      i.addEventListener('keydown', onKey)
      i.tabIndex = 0
    })
    return () => {
      inputs.forEach(i => {
        i.removeEventListener('blur', onBlur)
        i.removeEventListener('keydown', onKey)
      })
    }
  }, [])
  return null
}
