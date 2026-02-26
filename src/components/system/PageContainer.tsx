import React from 'react'

type Props = {
  children: React.ReactNode
  className?: string
}

export default function PageContainer({ children, className }: Props) {
  return <div className={`max-w-6xl mx-auto p-4 ${className ?? ''}`}>{children}</div>
}
