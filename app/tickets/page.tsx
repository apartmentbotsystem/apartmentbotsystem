import { prisma } from '@/lib/db'
import { getActiveMonth } from '@/lib/context'

export default async function TicketsPage() {
  const { year, month } = await getActiveMonth()
  const consumptionDate = new Date(year, month - 2, 1)
  const consumptionYm = `${consumptionDate.getFullYear()}-${String(consumptionDate.getMonth() + 1).padStart(2, '0')}`
  const tickets = await prisma.ticket.findMany({ take: 50, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, createdAt: true, roomNumber: true } })
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">ทิกเก็ต</h1>
      <div className="text-xs opacity-70">บิล เดือน: {year}-{String(month).padStart(2, '0')} | รอบใช้หน่วย: {consumptionYm}</div>
      <div className="overflow-auto border erp-border rounded">
        <table className="min-w-[560px] w-full text-xs">
          <thead className="border-b erp-border bg-[var(--bg-page)] sticky top-0">
            <tr className="[&>th]:px-2 [&>th]:py-2"><th>วันที่</th><th>สถานะ</th><th>ห้อง</th></tr>
          </thead>
          <tbody className="[&>tr>*]:px-2 [&>tr>*]:py-1">
            {tickets.map(t => (
              <tr key={t.id} className="border-b erp-border">
                <td>{t.createdAt.toISOString().slice(0,10)}</td>
                <td><span className="chip">{t.status}</span></td>
                <td>{t.roomNumber}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


