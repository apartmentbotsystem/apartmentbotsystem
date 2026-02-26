import { prisma } from '@/lib/db'
import Link from 'next/link'
import { getActiveMonth } from '@/lib/context'
import { formatYm, getConsumptionYm } from '@/lib/datetime'
import EmptyState from '@/components/system/EmptyState'

export default async function ห้องพักPage() {
  const { year, month } = await getActiveMonth()
  const consumptionYm = getConsumptionYm(year, month)
  const floors = await prisma.floor.findMany({ select: { idx: true, name: true }, orderBy: { idx: 'asc' } })

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">ห้องพัก</h1>
      <div className="text-xs opacity-70">บิล เดือน: {formatYm(year, month)} | รอบใช้หน่วย: {consumptionYm}</div>
      {floors.length === 0 ? (
        <div className="p-6 border erp-border rounded">
          <EmptyState title="ยังไม่มีข้อมูลห้องพัก" description="เพิ่มข้อมูลชั้นและห้องเพื่อเริ่มจัดการระบบ" />
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {floors.map((f) => (
            <Link key={f.idx} href={`/rooms/floor/${f.idx}`} className="p-4 border erp-border rounded hover:border-primary">
              <div className="text-sm opacity-80">Floor</div>
              <div className="text-2xl font-bold">{f.idx}</div>
              <div className="text-xs mt-1">{f.name}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}


