import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getActiveMonth } from '@/lib/context'
import { formatYm, getConsumptionYm } from '@/lib/datetime'
import EmptyState from '@/components/system/EmptyState'

type Tab = 'revenue' | 'occupancy' | 'overdue' | 'collection'

function clampPercent(v: number): number {
  if (!Number.isFinite(v)) return 0
  if (v < 0) return 0
  if (v > 100) return 100
  return v
}

export default async function AnalyticsPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const { year, month } = await getActiveMonth()
  const consumptionYm = getConsumptionYm(year, month)

  const tabInput = String(searchParams?.tab ?? 'revenue')
  const tab: Tab = tabInput === 'occupancy' || tabInput === 'overdue' || tabInput === 'collection' ? tabInput : 'revenue'

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - 1, 1)
    d.setMonth(d.getMonth() - i)
    return { y: d.getFullYear(), m: d.getMonth() + 1 }
  }).reverse()

  const data = await Promise.all(months.map(async ({ y, m }) => {
    const [records, matches] = await Promise.all([
      prisma.billingRecord.findMany({
        where: { billingMonth: { year: y, month: m } },
        select: { id: true, dueDate: true, rent: true, water: true, electric: true, other: true, amount: true }
      }),
      prisma.paymentMatch.findMany({
        where: { billingRecord: { billingMonth: { year: y, month: m } }, confirmed: true },
        select: { billingRecordId: true, matchedAmount: true, confirmedAt: true, billingRecord: { select: { dueDate: true } } }
      })
    ])

    const breakdown = records.reduce((sum, r) => {
      sum.rent += Number(r.rent ?? 0)
      sum.water += Number(r.water ?? 0)
      sum.electric += Number(r.electric ?? 0)
      sum.other += Number(r.other ?? 0)
      sum.grand += Number(r.amount ?? 0)
      return sum
    }, { rent: 0, water: 0, electric: 0, other: 0, grand: 0 })

    const paidByRecord = new Map<string, number>()
    for (const match of matches) {
      paidByRecord.set(match.billingRecordId, (paidByRecord.get(match.billingRecordId) ?? 0) + Number(match.matchedAmount))
    }

    const overdue = records.filter((r) => (Number(r.amount) - (paidByRecord.get(r.id) ?? 0)) > 0).length
    const paid = [...paidByRecord.values()].reduce((s, n) => s + n, 0)
    const collectionRate = breakdown.grand > 0 ? (paid / breakdown.grand) * 100 : 0

    const earliestConfirm = new Map<string, Date>()
    for (const match of matches) {
      if (!match.confirmedAt) continue
      const existing = earliestConfirm.get(match.billingRecordId)
      if (!existing || match.confirmedAt < existing) earliestConfirm.set(match.billingRecordId, match.confirmedAt)
    }

    let speedDaysTotal = 0
    let speedCount = 0
    for (const record of records) {
      const firstPayAt = earliestConfirm.get(record.id)
      if (!firstPayAt || !record.dueDate) continue
      const diffMs = firstPayAt.getTime() - record.dueDate.getTime()
      speedDaysTotal += diffMs / (1000 * 60 * 60 * 24)
      speedCount += 1
    }

    const avgCollectionDays = speedCount > 0 ? speedDaysTotal / speedCount : 0

    return { y, m, revenue: breakdown.grand, overdue, collectionRate, avgCollectionDays }
  }))

  const [rooms, floors] = await Promise.all([
    prisma.room.findMany({ select: { status: true, floorId: true } }),
    prisma.floor.findMany({ select: { id: true, idx: true, name: true }, orderBy: { idx: 'asc' } })
  ])

  const occupied = rooms.filter((r) => r.status === 'OCCUPIED').length
  const occupancyRate = rooms.length > 0 ? (occupied / rooms.length) * 100 : 0

  const byFloor = floors.map((f) => {
    const floorRooms = rooms.filter((r) => r.floorId === f.id)
    const floorOccupied = floorRooms.filter((r) => r.status === 'OCCUPIED').length
    const rate = floorRooms.length > 0 ? (floorOccupied / floorRooms.length) * 100 : 0
    return { floor: f.idx, name: f.name, total: floorRooms.length, occupied: floorOccupied, rate }
  })

  const hasAnalytics = rooms.length > 0 || data.some((d) => d.revenue > 0 || d.overdue > 0 || d.collectionRate > 0)

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">วิเคราะห์ข้อมูล</h1>
      <div className="text-xs opacity-70">รอบบิล: {formatYm(year, month)} | รอบใช้หน่วย: {consumptionYm}</div>

      {!hasAnalytics && (
        <div className="p-6 border erp-border rounded">
          <EmptyState title="ยังไม่มีข้อมูลวิเคราะห์" description="เมื่อมีรายการบิลและการชำระเงิน จะแสดงกราฟและตารางสรุปที่นี่" />
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/analytics?tab=revenue" className={`px-2 py-1 border erp-border rounded ${tab === 'revenue' ? 'bg-[var(--bg-surface)]' : ''}`}>รายรับรายเดือน</Link>
        <Link href="/analytics?tab=occupancy" className={`px-2 py-1 border erp-border rounded ${tab === 'occupancy' ? 'bg-[var(--bg-surface)]' : ''}`}>อัตราเข้าอยู่</Link>
        <Link href="/analytics?tab=overdue" className={`px-2 py-1 border erp-border rounded ${tab === 'overdue' ? 'bg-[var(--bg-surface)]' : ''}`}>แนวโน้มค้างชำระ</Link>
        <Link href="/analytics?tab=collection" className={`px-2 py-1 border erp-border rounded ${tab === 'collection' ? 'bg-[var(--bg-surface)]' : ''}`}>ความเร็วการเก็บเงิน</Link>
      </div>

      {hasAnalytics && tab === 'revenue' && (
        <section className="border erp-border rounded p-3 space-y-2">
          <div className="font-semibold">รายรับรายเดือน</div>
          {data.map((d) => {
            const max = Math.max(...data.map((x) => x.revenue), 1)
            const width = clampPercent((d.revenue / max) * 100)
            return (
              <div key={`${d.y}-${d.m}`} className="space-y-1">
                <div className="text-sm flex justify-between"><span>{formatYm(d.y, d.m)}</span><strong>{d.revenue.toFixed(2)}</strong></div>
                <div className="h-2 rounded bg-[var(--bg-surface)]"><div className="h-2 rounded bg-[var(--fg-accent)]" style={{ width: `${width}%` }} /></div>
              </div>
            )
          })}
        </section>
      )}

      {hasAnalytics && tab === 'occupancy' && (
        <section className="border erp-border rounded p-3 space-y-2">
          <div className="font-semibold">อัตราเข้าอยู่</div>
          <div className="text-sm">อัตราปัจจุบัน: <strong>{clampPercent(occupancyRate).toFixed(1)}%</strong> ({occupied}/{rooms.length})</div>
          <div className="overflow-auto border erp-border rounded">
            <table className="w-full text-sm">
              <thead><tr className="[&>th]:px-2 [&>th]:py-2 border-b erp-border text-left"><th>ชั้น</th><th>ห้องทั้งหมด</th><th>มีผู้เช่า</th><th>อัตรา</th></tr></thead>
              <tbody>{byFloor.map((f) => (<tr key={f.floor} className="[&>td]:px-2 [&>td]:py-1 border-b erp-border"><td>{f.floor} ({f.name})</td><td>{f.total}</td><td>{f.occupied}</td><td>{clampPercent(f.rate).toFixed(1)}%</td></tr>))}</tbody>
            </table>
          </div>
        </section>
      )}

      {hasAnalytics && tab === 'overdue' && (
        <section className="border erp-border rounded p-3 space-y-2">
          <div className="font-semibold">แนวโน้มค้างชำระ</div>
          <div className="overflow-auto border erp-border rounded">
            <table className="w-full text-sm">
              <thead><tr className="[&>th]:px-2 [&>th]:py-2 border-b erp-border text-left"><th>เดือน</th><th>ห้องค้างชำระ</th></tr></thead>
              <tbody>{data.map((d) => (<tr key={`o-${d.y}-${d.m}`} className="[&>td]:px-2 [&>td]:py-1 border-b erp-border"><td>{formatYm(d.y, d.m)}</td><td>{d.overdue}</td></tr>))}</tbody>
            </table>
          </div>
        </section>
      )}

      {hasAnalytics && tab === 'collection' && (
        <section className="border erp-border rounded p-3 space-y-2">
          <div className="font-semibold">ความเร็วการเก็บเงิน</div>
          <div className="overflow-auto border erp-border rounded">
            <table className="w-full text-sm">
              <thead><tr className="[&>th]:px-2 [&>th]:py-2 border-b erp-border text-left"><th>เดือน</th><th>อัตราเก็บเงิน</th><th>เฉลี่ยวันเทียบกำหนดชำระ</th></tr></thead>
              <tbody>{data.map((d) => (<tr key={`c-${d.y}-${d.m}`} className="[&>td]:px-2 [&>td]:py-1 border-b erp-border"><td>{formatYm(d.y, d.m)}</td><td>{clampPercent(d.collectionRate).toFixed(1)}%</td><td>{d.avgCollectionDays.toFixed(1)} วัน</td></tr>))}</tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
