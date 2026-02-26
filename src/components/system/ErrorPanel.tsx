import React from 'react'

type Props = {
  error?: unknown
  message?: string
  className?: string
}

export default function ErrorPanel({ error, message, className }: Props) {
  const text =
    typeof message === 'string' && message
      ? message
      : error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : 'Something went wrong'
  return <div className={`bg-rose-50 text-rose-700 border border-rose-200 rounded p-3 ${className ?? ''}`}>{text}</div>
}
