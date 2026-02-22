"use client"
import { useEffect, useState } from 'react'

type Summary = { rooms: number; occupied: number; occupancyRate: number; billing: { total: number; balance: number }; ticketsOpen: number }

export default function AnalyticsPage() {
  const [data, setData] = useState<Summary | null>(null)
  const load = async () => {
    const res = await fetch('/api/analytics/summary')
    const json = await res.json()
    setData(json)
  }
  useEffect(() => { load() }, [])
  if (!data) return <main className="container"><p>Loading...</p></main>
  return (
    <main className="container">
      <h1>ภาพรวม</h1>
      <ul>
        <li>จำนวนห้องทั้งหมด: {data.rooms}</li>
        <li>ห้องที่มีผู้พัก: {data.occupied} ({(data.occupancyRate * 100).toFixed(1)}%)</li>
        <li>ยอดบิลเดือนล่าสุด: {data.billing.total.toLocaleString()} บาท</li>
        <li>ยอดคงค้างเดือนล่าสุด: {data.billing.balance.toLocaleString()} บาท</li>
        <li>ทิกเก็ตที่เปิดอยู่: {data.ticketsOpen}</li>
      </ul>
    </main>
  )
}
