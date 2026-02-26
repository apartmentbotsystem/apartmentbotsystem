import React from 'react'

type Props = {
  title?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export default function SectionCard({ title, actions, children, className }: Props) {
  return (
    <div className={`border rounded-lg p-4 bg-white ${className ?? ''}`}>
      {(title || actions) ? (
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">{title}</div>
          {actions ? <div>{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}
