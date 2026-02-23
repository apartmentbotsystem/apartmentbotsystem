import { prisma } from '@/lib/db'
import Link from 'next/link'
import { getActiveMonth } from '@/lib/context'

export default async function ห้องพักPage() {
  const { year, month } = await getActiveMonth()
  const consumptionDate = new Date(year, month - 2, 1)
  const consumptionYm = `${consumptionDate.getFullYear()}-${String(consumptionDate.getMonth() + 1).padStart(2, '0')}`
  const floors = await prisma.floor.findMany({ select: { idx: true, name: true }, orderBy: { idx: 'asc' } })

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">ห้องพัก</h1>
      <div className="text-xs opacity-70">บิล เดือน: {year}-{String(month).padStart(2, '0')} | รอบใช้หน่วย: {consumptionYm}</div>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {floors.map((f) => (
          <Link key={f.idx} href={`/rooms/floor/${f.idx}`} className="p-4 border erp-border rounded hover:border-primary">
            <div className="text-sm opacity-80">Floor</div>
            <div className="text-2xl font-bold">{f.idx}</div>
            <div className="text-xs mt-1">{f.name}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}


