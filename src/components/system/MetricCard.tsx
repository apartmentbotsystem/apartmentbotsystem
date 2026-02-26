import React from 'react'

type Props = {
  label: string
  countTo: number
  suffix?: string
  hint?: string
  accent?: 'teal' | 'rose' | 'blue' | 'amber' | string
  className?: string
}

export default function MetricCard({ label, countTo, suffix, hint, accent = 'teal', className }: Props) {
  const color =
    accent === 'rose' ? 'text-rose-600' :
    accent === 'blue' ? 'text-blue-600' :
    accent === 'amber' ? 'text-amber-600' :
    'text-teal-600'
  return (
    <div className={`border rounded-lg p-4 bg-white ${className ?? ''}`}>
      <div className="text-sm text-neutral-600">{label}</div>
      <div className={`text-2xl font-semibold ${color}`}>
        {Intl.NumberFormat('en-US').format(countTo)}{suffix ? <span className="text-neutral-600 text-base ml-1">{suffix}</span> : null}
      </div>
      {hint ? <div className="text-xs text-neutral-500 mt-1">{hint}</div> : null}
    </div>
  )
}
