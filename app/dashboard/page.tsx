import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getActiveMonth, getActiveBuildingId, getActiveFloor } from '@/lib/context'
import { compareRoomNumbersNatural } from '@/lib/room-sort'

export const runtime = 'nodejs'

type RoomState = 'OCCUPIED' | 'VACANT' | 'AWAITING_PAYMENT' | 'OVERDUE' | 'SELF_USE' | 'MAINTENANCE'

function getRoomState(status: string, overdue: boolean, awaiting: boolean): RoomState {
  if (status === 'MAINTENANCE') return 'MAINTENANCE'
  if (status === 'SELF_USE') return 'SELF_USE'
  if (status === 'VACANT') return 'VACANT'
  if (overdue) return 'OVERDUE'
  if (awaiting) return 'AWAITING_PAYMENT'
  return 'OCCUPIED'
}

function roomStateClasses(state: RoomState): string {
  switch (state) {
    case 'OVERDUE':
      return 'border-red-300 bg-red-50 text-red-800'
    case 'AWAITING_PAYMENT':
      return 'border-yellow-300 bg-yellow-50 text-yellow-800'
    case 'VACANT':
      return 'border-slate-300 bg-slate-50 text-slate-700'
    case 'SELF_USE':
      return 'border-sky-300 bg-sky-50 text-sky-800'
    case 'MAINTENANCE':
      return 'border-violet-300 bg-violet-50 text-violet-800'
    case 'OCCUPIED':
    default:
      return 'border-emerald-300 bg-emerald-50 text-emerald-800'
  }
}

export default async function DashboardPage({ searchParams }: { searchParams?: { floor?: string } }) {
  const [{ year, month }, activeFloor] = await Promise.all([
    getActiveMonth(),
    getActiveFloor()
  ])
  const consumptionDate = new Date(year, month - 2, 1)
  const consumptionYm = `${consumptionDate.getFullYear()}-${String(consumptionDate.getMonth() + 1).padStart(2, '0')}`
  const buildingId = await getActiveBuildingId()
  const roomWhere: { buildingId?: string } = buildingId ? { buildingId } : {}

  const last6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - 1, 1)
    d.setMonth(d.getMonth() - i)
    return { y: d.getFullYear(), m: d.getMonth() + 1 }
  }).reverse()

  const [totalRooms, occupiedRooms, maintenanceRooms, selfUseRooms, records, matches, activeTickets, activeVersions, floors, allRooms, lineUnread, trendRows] = await Promise.all([
    prisma.room.count({ where: roomWhere }),
    prisma.room.count({ where: { status: 'OCCUPIED', ...roomWhere } }),
    prisma.room.count({ where: { status: 'MAINTENANCE', ...roomWhere } }),
    prisma.room.count({ where: { status: 'SELF_USE', ...roomWhere } }),
    prisma.billingRecord.findMany({
      where: { billingMonth: { year, month }, room: roomWhere },
      select: { id: true, amount: true, dueDate: true, roomNumber: true, rent: true, water: true, electric: true, other: true }
    }),
    prisma.paymentMatch.findMany({
      where: { billingRecord: { billingMonth: { year, month } }, confirmed: true },
      select: { billingRecordId: true, matchedAmount: true }
    }),
    prisma.ticket.count({ where: { status: { not: 'CLOSED' }, room: buildingId ? { buildingId } : undefined } }),
    prisma.billingVersion.count({ where: { billingMonth: { year, month }, isActive: true, room: roomWhere } }),
    prisma.floor.findMany({ orderBy: { idx: 'asc' }, select: { id: true, idx: true, name: true } }),
    prisma.room.findMany({ where: roomWhere, include: { floor: { select: { id: true, idx: true, name: true } } } }),
    prisma.conversation.aggregate({ _sum: { unreadAdmin: true } }),
    Promise.all(last6.map(async ({ y, m }) => {
      const [rs, ms] = await Promise.all([
        prisma.billingRecord.findMany({ where: { billingMonth: { year: y, month: m }, room: roomWhere }, select: { id: true, amount: true } }),
        prisma.paymentMatch.findMany({ where: { billingRecord: { billingMonth: { year: y, month: m }, room: roomWhere }, confirmed: true }, select: { matchedAmount: true } })
      ])
      const billed = rs.reduce((s, r) => s + Number(r.amount ?? 0), 0)
      const collected = ms.reduce((s, m2) => s + Number(m2.matchedAmount ?? 0), 0)
      return { y, m, billed, collected }
    }))
  ])

  const breakdown = records.reduce((sum, row) => {
    sum.rent += Number(row.rent ?? 0)
    sum.water += Number(row.water ?? 0)
    sum.electric += Number(row.electric ?? 0)
    sum.other += Number(row.other ?? 0)
    sum.grand += Number(row.amount ?? 0)
    return sum
  }, { rent: 0, water: 0, electric: 0, other: 0, grand: 0 })

  const paidByRecord = new Map<string, number>()
  for (const match of matches) {
    paidByRecord.set(match.billingRecordId, (paidByRecord.get(match.billingRecordId) ?? 0) + Number(match.matchedAmount))
  }

  const now = new Date()
  const overdue = records.filter((row) => {
    const paid = paidByRecord.get(row.id) ?? 0
    const balance = Number(row.amount) - paid
    return Boolean(row.dueDate && row.dueDate < now && balance > 0)
  }).length

  const occupancyRate = totalRooms === 0 ? 0 : Math.round((occupiedRooms / totalRooms) * 100)
  const vacantRooms = Math.max(totalRooms - occupiedRooms - maintenanceRooms - selfUseRooms, 0)
  const pendingPayments = records.filter((row) => (Number(row.amount) - (paidByRecord.get(row.id) ?? 0)) > 0).length
  const collectedTotal = matches.reduce((s, m) => s + Number(m.matchedAmount ?? 0), 0)
  const lineUnreadCount = Number(lineUnread._sum.unreadAdmin ?? 0)

  const searchFloor = Number(searchParams?.floor ?? '')
  const selectedFloorIdx = Number.isFinite(searchFloor) ? searchFloor : activeFloor
  const selectedFloor = (selectedFloorIdx ? floors.find((f) => f.idx === selectedFloorIdx) : null) ?? floors[0] ?? null

  const floorRooms = allRooms
    .filter((r) => (selectedFloor ? r.floor?.id === selectedFloor.id : true))
    .sort((a, b) => compareRoomNumbersNatural(a.number, b.number))

  const recordByRoom = new Map(records.map((r) => [r.roomNumber, r]))

  return (
    <div className="grid gap-3">
      <div className="text-sm">รอบบิล: {year}-{String(month).padStart(2, '0')} | รอบใช้หน่วย: {consumptionYm} {buildingId ? `(อาคาร ${buildingId})` : ''}</div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="p-3 border-l-4 border-primary rounded erp-border border flex flex-col gap-1"><div className="text-sm opacity-80">ห้องทั้งหมด</div><div className="text-2xl font-bold">{totalRooms}</div></div>
        <div className="p-3 border-l-4 border-primary rounded erp-border border flex flex-col gap-1"><div className="text-sm opacity-80">มีผู้เช่า</div><div className="text-2xl font-bold">{occupiedRooms}</div></div>
        <div className="p-3 border-l-4 border-primary rounded erp-border border flex flex-col gap-1"><div className="text-sm opacity-80">ห้องว่าง</div><div className="text-2xl font-bold">{vacantRooms}</div></div>
        <div className="p-3 border-l-4 border-primary rounded erp-border border flex flex-col gap-1"><div className="text-sm opacity-80">ซ่อมบำรุง</div><div className="text-2xl font-bold">{maintenanceRooms}</div></div>
        <div className="p-3 border-l-4 border-primary rounded erp-border border flex flex-col gap-1"><div className="text-sm opacity-80">ใช้เอง</div><div className="text-2xl font-bold">{selfUseRooms}</div></div>
        <div className="p-3 border-l-4 border-primary rounded erp-border border flex flex-col gap-1"><div className="text-sm opacity-80">รอบบิลปัจจุบัน</div><div className="text-2xl font-bold">{year}-{String(month).padStart(2, '0')}</div></div>
        <div className="p-3 border-l-4 border-primary rounded erp-border border flex flex-col gap-1"><div className="text-sm opacity-80">จำนวนเรคคอร์ดเวอร์ชันปัจจุบัน</div><div className="text-2xl font-bold">{activeVersions}</div></div>
        <div className="p-3 border-l-4 border-primary rounded erp-border border flex flex-col gap-1"><div className="text-sm opacity-80">รายการรอชำระ</div><div className="text-2xl font-bold">{pendingPayments}</div></div>
        <div className="p-3 border-l-4 border-primary rounded erp-border border flex flex-col gap-1"><div className="text-sm opacity-80">รายรับเดือนนี้</div><div className="text-2xl font-bold">{breakdown.grand.toFixed(2)}</div></div>
        <div className="p-3 border-l-4 border-primary rounded erp-border border flex flex-col gap-1"><div className="text-sm opacity-80">ยอดรับรวม</div><div className="text-2xl font-bold">{collectedTotal.toFixed(2)}</div></div>
        <div className="p-3 border-l-4 border-primary rounded erp-border border flex flex-col gap-1"><div className="text-sm opacity-80">ค้างชำระ</div><div className="text-2xl font-bold">{overdue}</div></div>
        <div className="p-3 border-l-4 border-primary rounded erp-border border flex flex-col gap-1"><div className="text-sm opacity-80">ทิกเก็ตที่เปิดอยู่</div><div className="text-2xl font-bold">{activeTickets}</div></div>
        <div className="p-3 border-l-4 border-primary rounded erp-border border flex flex-col gap-1"><div className="text-sm opacity-80">อัตราการเข้าอยู่</div><div className="text-2xl font-bold">{occupancyRate}%</div></div>
        <div className="p-3 border-l-4 border-primary rounded erp-border border flex flex-col gap-1"><div className="text-sm opacity-80">LINE ยังไม่อ่าน</div><div className="text-2xl font-bold">{lineUnreadCount}</div></div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="p-3 border rounded erp-border flex flex-col gap-1"><div className="text-sm opacity-80">ค่าเช่า</div><div className="text-xl font-semibold text-right">{breakdown.rent.toFixed(2)}</div></div>
        <div className="p-3 border rounded erp-border flex flex-col gap-1"><div className="text-sm opacity-80">ค่าน้ำ</div><div className="text-xl font-semibold text-right">{breakdown.water.toFixed(2)}</div></div>
        <div className="p-3 border rounded erp-border flex flex-col gap-1"><div className="text-sm opacity-80">ค่าไฟ</div><div className="text-xl font-semibold text-right">{breakdown.electric.toFixed(2)}</div></div>
        <div className="p-3 border rounded erp-border flex flex-col gap-1"><div className="text-sm opacity-80">อื่นๆ</div><div className="text-xl font-semibold text-right">{breakdown.other.toFixed(2)}</div></div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="md:col-span-2 border erp-border rounded p-3 space-y-3">
          <div className="font-semibold">แผนผังชั้น</div>
          <div className="flex flex-wrap gap-2">{floors.map((f) => (<Link key={f.id} href={`/dashboard?floor=${f.idx}`} className={`px-2 py-1 border rounded text-sm ${selectedFloor?.id === f.id ? 'bg-[var(--bg-surface)] erp-border' : 'erp-border'}`}>ชั้น {f.idx}</Link>))}</div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {floorRooms.map((room) => {
              const rec = recordByRoom.get(room.number)
              const paid = rec ? (paidByRecord.get(rec.id) ?? 0) : 0
              const due = rec?.dueDate ?? null
              const outstanding = rec ? (Number(rec.amount) - paid) : 0
              const roomState = getRoomState(room.status, Boolean(due && due < now && outstanding > 0), outstanding > 0)
              return (<Link key={room.number} href={`/rooms/${encodeURIComponent(room.number)}`} className={`border rounded px-2 py-2 text-sm font-medium ${roomStateClasses(roomState)}`}><div>{room.number}</div><div className="text-[11px] opacity-80">{roomState}</div></Link>)
            })}
          </div>
          {selectedFloor && <div className="text-xs opacity-70">กำลังแสดงชั้น {selectedFloor.idx} ({selectedFloor.name})</div>}
        </div>

        <div className="border erp-border rounded p-3 space-y-2">
          <div className="font-semibold">เมนูด่วน</div>
          <div className="grid gap-2 text-sm">
            <Link href="/occupancy" className="px-2 py-2 border erp-border rounded">ย้ายเข้า / ย้ายออก</Link>
            <Link href="/admin/billing/upload" className="px-2 py-2 border erp-border rounded">อัปโหลด Excel</Link>
            <Link href="/admin/documents/generate" className="px-2 py-2 border erp-border rounded">สร้างเอกสาร</Link>
            <Link href="/line" className="px-2 py-2 border erp-border rounded">ส่งเตือน (LINE)</Link>
          </div>
        </div>
      </div>

      <div className="border erp-border rounded p-3 space-y-2">
        <div className="font-semibold">แนวโน้ม 6 เดือน</div>
        <div className="grid gap-2">
          {trendRows.map((row) => {
            const max = Math.max(1, ...trendRows.map((r) => r.billed))
            const billedW = Math.max(2, (row.billed / max) * 100)
            const collectedW = Math.max(2, (row.collected / max) * 100)
            return (
              <div key={`${row.y}-${row.m}`} className="space-y-1">
                <div className="text-xs flex items-center justify-between"><span>{row.y}-{String(row.m).padStart(2, '0')}</span><span>ออกบิล {row.billed.toFixed(2)} | เก็บเงิน {row.collected.toFixed(2)}</span></div>
                <div className="h-2 rounded bg-[var(--bg-surface)]"><div className="h-2 rounded bg-cyan-500" style={{ width: `${billedW}%` }} /></div>
                <div className="h-2 rounded bg-[var(--bg-surface)]"><div className="h-2 rounded bg-emerald-500" style={{ width: `${collectedW}%` }} /></div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
