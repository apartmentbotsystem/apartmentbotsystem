import React from 'react'

type Point = { name: string; value: number }
export default function OccupancyAreaChart({ data }: { data: Point[] }) {
  const max = Math.max(1, ...data.map(d => d.value))
  const w = 300, h = 140, pad = 10
  const step = (w - pad * 2) / Math.max(1, data.length - 1)
  const points = data.map((d, i) => {
    const x = pad + i * step
    const y = h - pad - (d.value / max) * (h - pad * 2)
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} className="block">
      <polygon points={`${pad},${h - pad} ${points} ${w - pad},${h - pad}`} className="fill-blue-200" />
    </svg>
  )
}
