import Link from 'next/link'
import { prisma } from '@/lib/db'
import { compareRoomNumbersNatural } from '@/lib/room-sort'

export default async function TenantDetailPage({ params }: { params: { id: string } }) {
  const resident = await prisma.resident.findUnique({
    where: { id: params.id },
    select: { id: true, fullName: true }
  })

  if (!resident) return <div className="p-4">Tenant not found</div>

  const [residencies, moves, conversations] = await Promise.all([
    prisma.roomResident.findMany({
      where: { residentId: resident.id },
      select: { roomNumber: true, active: true, startDate: true, endDate: true },
      orderBy: [{ active: 'desc' }, { startDate: 'desc' }]
    }),
    prisma.moveHistory.findMany({
      where: { residentId: resident.id },
      select: { id: true, roomNumber: true, type: true, at: true },
      orderBy: { at: 'desc' },
      take: 20
    }),
    prisma.conversation.findMany({
      where: { residentId: resident.id },
      select: { id: true, lineUserId: true, roomNumber: true, unreadAdmin: true },
      orderBy: { lastMessageAt: 'desc' }
    })
  ])

  const currentResidency = residencies.find((r) => r.active) ?? null
  const roomNumbers = Array.from(new Set(residencies.map((r) => r.roomNumber))).sort(compareRoomNumbersNatural)

  const billing = roomNumbers.length
    ? await prisma.billingRecord.findMany({
        where: { roomNumber: { in: roomNumbers } },
        select: { id: true, roomNumber: true, amount: true, billingMonth: { select: { year: true, month: true } } },
        orderBy: [{ billingMonth: { year: 'desc' } }, { billingMonth: { month: 'desc' } }],
        take: 24
      })
    : []

  const payments = roomNumbers.length
    ? await prisma.payment.findMany({
        where: { matches: { some: { billingRecord: { roomNumber: { in: roomNumbers } } } } },
        select: {
          id: true,
          occurredAt: true,
          amount: true,
          matches: { select: { billingRecord: { select: { roomNumber: true } }, matchedAmount: true } }
        },
        orderBy: { occurredAt: 'desc' },
        take: 24
      })
    : []

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{resident.fullName}</h1>
          <div className="text-sm opacity-80">Current Room: {currentResidency?.roomNumber ?? '-'}</div>
        </div>
        <Link href="/tenants" className="text-sm hover:text-primary">Back to Tenants</Link>
      </div>

      <section className="border erp-border rounded p-3">
        <div className="font-semibold mb-2">Room History</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="[&>th]:px-2 [&>th]:py-2 border-b erp-border text-left">
              <th>Room</th>
              <th>Status</th>
              <th>Start</th>
              <th>End</th>
            </tr>
          </thead>
          <tbody>
            {residencies.map((r, idx) => (
              <tr key={`${r.roomNumber}:${idx}`} className="[&>td]:px-2 [&>td]:py-1 border-b erp-border">
                <td><Link href={`/rooms/${encodeURIComponent(r.roomNumber)}`} className="hover:text-primary">{r.roomNumber}</Link></td>
                <td>{r.active ? 'ACTIVE' : 'ARCHIVED'}</td>
                <td>{r.startDate.toISOString().slice(0, 10)}</td>
                <td>{r.endDate ? r.endDate.toISOString().slice(0, 10) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="border erp-border rounded p-3">
        <div className="font-semibold mb-2">Billing History</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="[&>th]:px-2 [&>th]:py-2 border-b erp-border text-left">
              <th>Month</th>
              <th>Room</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {billing.map((b) => (
              <tr key={b.id} className="[&>td]:px-2 [&>td]:py-1 border-b erp-border">
                <td>{b.billingMonth.year}-{String(b.billingMonth.month).padStart(2, '0')}</td>
                <td>{b.roomNumber}</td>
                <td className="text-right">{Number(b.amount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="border erp-border rounded p-3">
        <div className="font-semibold mb-2">Payment History</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="[&>th]:px-2 [&>th]:py-2 border-b erp-border text-left">
              <th>Date</th>
              <th>Rooms</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="[&>td]:px-2 [&>td]:py-1 border-b erp-border">
                <td>{p.occurredAt.toISOString().slice(0, 10)}</td>
                <td>{Array.from(new Set(p.matches.map((m) => m.billingRecord.roomNumber))).sort(compareRoomNumbersNatural).join(', ') || '-'}</td>
                <td className="text-right">{Number(p.amount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="border erp-border rounded p-3">
        <div className="font-semibold mb-2">LINE Conversations</div>
        <div className="grid gap-2 text-sm">
          {conversations.map((c) => (
            <div key={c.id} className="border erp-border rounded p-2 flex items-center justify-between">
              <div>
                <div>Room: {c.roomNumber ?? '-'}</div>
                <div className="text-xs opacity-70">LINE: {c.lineUserId ?? '-'}</div>
              </div>
              <Link href={`/line?id=${c.id}`} className="px-2 py-1 border erp-border rounded text-xs">Open Chat</Link>
            </div>
          ))}
          {conversations.length === 0 && <div className="text-sm opacity-70">No conversation</div>}
        </div>
      </section>

      <section className="border erp-border rounded p-3">
        <div className="font-semibold mb-2">Move Events</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="[&>th]:px-2 [&>th]:py-2 border-b erp-border text-left">
              <th>Date</th>
              <th>Room</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {moves.map((m) => (
              <tr key={m.id} className="[&>td]:px-2 [&>td]:py-1 border-b erp-border">
                <td>{m.at.toISOString().slice(0, 19).replace('T', ' ')}</td>
                <td>{m.roomNumber}</td>
                <td>{m.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

