import React from 'react'

type Slice = { name: string; value: number }
export default function PaymentPieChart({ data }: { data: Slice[] }) {
  const total = data.reduce((s, x) => s + x.value, 0) || 1
  const r = 60
  let acc = 0
  const colors = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6']
  const slices = data.map((s, i) => {
    const start = (acc / total) * 2 * Math.PI
    acc += s.value
    const end = (acc / total) * 2 * Math.PI
    const x1 = 75 + r * Math.cos(start)
    const y1 = 75 + r * Math.sin(start)
    const x2 = 75 + r * Math.cos(end)
    const y2 = 75 + r * Math.sin(end)
    const large = end - start > Math.PI ? 1 : 0
    const d = `M75,75 L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`
    return <path key={i} d={d} fill={colors[i % colors.length]} />
  })
  return <svg width={150} height={150}>{slices}</svg>
}
