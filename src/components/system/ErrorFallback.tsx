import React from 'react'
import ErrorPanel from './ErrorPanel'

type Props = {
  error?: unknown
  className?: string
}

export default function ErrorFallback({ error, className }: Props) {
  return <ErrorPanel error={error} className={className} />
}
