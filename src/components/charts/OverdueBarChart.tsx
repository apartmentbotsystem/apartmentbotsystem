import React from 'react'

type Point = { name: string; value: number }
export default function OverdueBarChart({ data }: { data: Point[] }) {
  const max = Math.max(1, ...data.map(d => d.value))
  const w = 300, h = 140
  const barW = Math.floor(w / Math.max(1, data.length))
  return (
    <svg width={w} height={h} className="block">
      {data.map((d, i) => {
        const barH = Math.round((d.value / max) * (h - 10))
        return <rect key={i} x={i * barW + 2} y={h - barH} width={barW - 4} height={barH} className="fill-rose-400" />
      })}
    </svg>
  )
}
