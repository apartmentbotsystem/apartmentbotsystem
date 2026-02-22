import { prisma } from '@/lib/db'
import { Mappers } from '@/types'
import type { Ui } from '@/types'

export const dynamic = 'force-dynamic'

export default async function BillingPage() {
  const months = await prisma.billingMonth.findMany({
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    include: {
      records: {
        select: {
          amount: true,
          adjustments: true,
          payments: {
            where: { confirmed: true },
            select: { matchedAmount: true }
          }
        }
      }
    }
  })
  const summaries = Mappers.mapBillingMonthsDbToDomain(months)
  const rows: Ui.BillingSummaryRow[] = summaries.map((s) => ({
    id: s.id,
    ym: `${s.year}-${String(s.month).padStart(2, '0')}`,
    billed: s.totalBilled,
    received: s.totalReceived,
    outstanding: s.outstanding,
    closed: s.closed
  }))
  return (
    <main className="container">
      <h1>สรุปต่อเดือน</h1>
      <table>
        <thead>
          <tr>
            <th>รอบบิล</th>
            <th>ยอดตั้ง</th>
            <th>รับแล้ว</th>
            <th>ค้างรับ</th>
            <th>ปิดงวด</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>{r.ym}</td>
              <td>{r.billed.toLocaleString()}</td>
              <td>{r.received.toLocaleString()}</td>
              <td>{r.outstanding.toLocaleString()}</td>
              <td>{r.closed ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
