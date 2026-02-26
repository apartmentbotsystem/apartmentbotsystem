import React from 'react'

type Props = {
  title?: string
  description?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

export default function EmptyState({ title, description, children, className }: Props) {
  return (
    <div className={`text-center text-neutral-600 p-6 ${className ?? ''}`}>
      {title ? <div className="text-lg font-medium">{title}</div> : null}
      {description ? <div className="mt-1">{description}</div> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  )
}
