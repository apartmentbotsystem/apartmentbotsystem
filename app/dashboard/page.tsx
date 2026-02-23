import { prisma } from '@/lib/db'
import Link from 'next/link'

function fmt(n: number): string {
  return n.toLocaleString('th-TH')
}

export default async function DashboardPage() {
  const [totalRooms, occupiedRooms, vacantRooms, openTickets] = await Promise.all([
    prisma.room.count(),
    prisma.room.count({ where: { status: 'OCCUPIED' } }),
    prisma.room.count({ where: { status: 'VACANT' } }),
    prisma.ticket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } })
  ])

  const latestMonth = await prisma.billingMonth.findFirst({
    orderBy: [{ year: 'desc' }, { month: 'desc' }]
  })

  let overdueCount = 0
  let pendingCount = 0
  if (latestMonth) {
    const [overC, pendC] = await Promise.all([
      prisma.billingRecord.count({ where: { billingMonthId: latestMonth.id, status: 'OVERDUE' } }),
      prisma.billingRecord.count({ where: { billingMonthId: latestMonth.id, status: 'PENDING' } })
    ])
    overdueCount = overC
    pendingCount = pendC
  }

  const occRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">แดชบอร์ด</h1>
        <div className="text-sm opacity-70">
          ภาพรวมระบบและสถานะล่าสุด{latestMonth ? ` • รอบบิล: ${latestMonth.year}-${String(latestMonth.month).padStart(2, '0')}` : ''}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="p-4 border erp-border rounded">
          <div className="text-sm opacity-70">จำนวนห้องทั้งหมด</div>
          <div className="text-3xl font-bold">{fmt(totalRooms)}</div>
          <div className="text-xs mt-1 opacity-70">พร้อมใช้งาน: {fmt(vacantRooms)}</div>
        </div>
        <div className="p-4 border erp-border rounded">
          <div className="text-sm opacity-70">อัตราเข้าพัก</div>
          <div className="text-3xl font-bold">{fmt(occRate)}%</div>
          <div className="text-xs mt-1 opacity-70">กำลังพักอาศัย: {fmt(occupiedRooms)}</div>
        </div>
        <div className="p-4 border erp-border rounded">
          <div className="text-sm opacity-70">บิลค้างชำระ</div>
          <div className="text-3xl font-bold">{fmt(overdueCount)}</div>
          <div className="text-xs mt-1 opacity-70">บิลรอดำเนินการ: {fmt(pendingCount)}</div>
        </div>
        <div className="p-4 border erp-border rounded">
          <div className="text-sm opacity-70">ทิกเก็ตเปิดอยู่</div>
          <div className="text-3xl font-bold">{fmt(openTickets)}</div>
          <div className="text-xs mt-1 opacity-70">สถานะ OPEN/IN_PROGRESS</div>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <div className="p-4 border erp-border rounded">
          <div className="flex items-center justify-between">
            <div className="font-semibold">งานล่าสุด</div>
            <Link href="/tickets" className="text-sm text-primary hover:underline">ดูทั้งหมด</Link>
          </div>
          <div className="text-sm mt-2 opacity-70">ไปที่หน้าทิกเก็ตเพื่อจัดการงานแจ้งซ่อม</div>
        </div>
        <div className="p-4 border erp-border rounded">
          <div className="flex items-center justify-between">
            <div className="font-semibold">บิลและการชำระเงิน</div>
            <Link href="/billing" className="text-sm text-primary hover:underline">เปิดหน้า Billing</Link>
          </div>
          <div className="text-sm mt-2 opacity-70">ดูบิลรอบล่าสุดและจัดการสถานะ</div>
        </div>
      </div>
    </div>
  )
}
