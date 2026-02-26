import React from 'react'

type Props = {
  title: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export default function PageHeader({ title, subtitle, actions, className }: Props) {
  return (
    <div className={`flex items-start justify-between gap-4 mb-4 ${className ?? ''}`}>
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle ? <div className="text-muted-foreground mt-1">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
