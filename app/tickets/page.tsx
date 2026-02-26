import { prisma } from '@/lib/db'
import { getActiveMonth } from '@/lib/context'
import Link from 'next/link'
import { formatYm, getConsumptionYm } from '@/lib/datetime'
import EmptyState from '@/components/system/EmptyState'

export default async function TicketsPage() {
  const { year, month } = await getActiveMonth()
  const consumptionYm = getConsumptionYm(year, month)
  const tickets = await prisma.ticket.findMany({ take: 50, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, createdAt: true, roomNumber: true } })
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">ทิกเก็ต</h1>
      <div className="text-xs opacity-70">บิล เดือน: {formatYm(year, month)} | รอบใช้หน่วย: {consumptionYm}</div>
      {tickets.length === 0 ? (
        <div className="p-6 border erp-border rounded">
          <EmptyState title="ยังไม่มีทิกเก็ต" description="เมื่อมีการแจ้งปัญหาหรือคำขอ จะแสดงที่นี่" />
        </div>
      ) : (
        <div className="overflow-auto border erp-border rounded">
          <table className="min-w-[560px] w-full text-xs">
            <thead className="border-b erp-border bg-[var(--bg-page)] sticky top-0">
              <tr className="[&>th]:px-2 [&>th]:py-2"><th>วันที่</th><th>สถานะ</th><th>ห้อง</th></tr>
            </thead>
            <tbody className="[&>tr>*]:px-2 [&>tr>*]:py-1">
              {tickets.map(t => (
                <tr key={t.id} className="border-b erp-border hover:bg-[var(--bg-card)]">
                  <td>
                    <Link prefetch={false} href={`/tickets/${t.id}`} className="erp-link">
                      {t.createdAt.toISOString().slice(0,10)}
                    </Link>
                  </td>
                  <td>
                    <Link prefetch={false} href={`/tickets/${t.id}`} className="chip inline-block">
                      {t.status}
                    </Link>
                  </td>
                  <td>
                    <Link prefetch={false} href={`/tickets/${t.id}`} className="erp-link">
                      {t.roomNumber}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
