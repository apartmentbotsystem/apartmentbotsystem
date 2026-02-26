import { prisma } from '@/lib/db'
import Link from 'next/link'
import { compareRoomNumbersNatural } from '@/lib/room-sort'
import { getActiveMonth } from '@/lib/context'
import { formatYm, getConsumptionYm } from '@/lib/datetime'

export default async function TenantsPage({ searchParams }: { searchParams?: { q?: string; page?: string; take?: string } }) {
  const { year, month } = await getActiveMonth()
  const consumptionYm = getConsumptionYm(year, month)
  const q = String(searchParams?.q ?? '').trim()
  const page = Math.max(1, Number.parseInt(String(searchParams?.page ?? '1'), 10) || 1)
  const takeRaw = Number.parseInt(String(searchParams?.take ?? '50'), 10)
  const take = Math.min(200, Math.max(1, Number.isFinite(takeRaw) ? takeRaw : 50))
  const skip = (page - 1) * take
  const actives = await prisma.roomResident.findMany({
    where: {
      active: true,
      ...(q
        ? {
            OR: [
              { resident: { fullName: { contains: q, mode: 'insensitive' } } },
              { room: { number: { contains: q, mode: 'insensitive' } } }
            ]
          }
        : {})
    },
    include: {
      resident: true,
      room: { select: { number: true, status: true } }
    },
    orderBy: { startDate: 'desc' },
    skip,
    take
  })
  const residentIds = actives.map(a => a.residentId)
  const convs = await prisma.conversation.findMany({
    where: { residentId: { in: residentIds } },
    select: { residentId: true, lineUserId: true }
  })
  const lineMap = new Map(convs.map(c => [c.residentId, c.lineUserId]))
  const rows = [...actives].sort((a, b) => compareRoomNumbersNatural(a.room.number, b.room.number))
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">ผู้เช่า</h1>
      <div className="text-xs opacity-70">บิล เดือน: {formatYm(year, month)} | รอบใช้หน่วย: {consumptionYm}</div>
      <form method="GET" className="flex items-center gap-2 text-sm">
        <input
          name="q"
          defaultValue={q}
          placeholder="ค้นหาจากชื่อหรือห้อง"
          className="border erp-border rounded px-2 py-1 w-72"
        />
        <button type="submit" className="px-2 py-1 border erp-border rounded">ค้นหา</button>
      </form>
      <div className="border erp-border rounded overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-page)] sticky top-0">
            <tr className="[&>th]:px-2 [&>th]:py-2 text-left">
              <th>ชื่อ</th>
              <th className="text-right">ห้อง</th>
              <th>สถานะ</th>
              <th>เริ่ม</th>
              <th>สิ้นสุด</th>
              <th>LINE</th>
            </tr>
          </thead>
          <tbody className="[&>tr>*]:px-2 [&>tr>*]:py-1">
            {rows.map(a => (
              <tr key={a.id} className="hover:bg-[var(--bg-surface)]">
                <td>
                  <Link href={`/tenants/${a.resident.id}`} className="hover:text-primary">{a.resident.fullName}</Link>
                </td>
                <td className="text-right">{a.room.number}</td>
                <td>{a.room.status}</td>
                <td>{a.startDate.toISOString().slice(0,10)}</td>
                <td>{a.endDate ? a.endDate.toISOString().slice(0,10) : '-'}</td>
                <td>{lineMap.get(a.residentId) ? 'เชื่อมแล้ว' : '—'} {a.room.number ? <Link href={`/rooms/${encodeURIComponent(a.room.number)}`} className="ml-2 text-xs hover:text-primary">ห้อง</Link> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

