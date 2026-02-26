﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import { prisma } from '@/lib/db'
import Link from 'next/link'
import { getActiveMonth } from '@/lib/context'
import { formatYm, getConsumptionYm } from '@/lib/datetime'

function toNum(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function readUsage(raw: unknown): { water: number; electric: number } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { water: 0, electric: 0 }
  const row = raw as Record<string, unknown>
  const water = toNum(row['ใช้น้ำ'] ?? row['waterUsage'] ?? row['water'])
  const electric = toNum(row['ใช้ไฟ'] ?? row['electricUsage'] ?? row['electric'])
  return { water, electric }
}

export default async function RoomDetailPage({ params }: { params: { roomId: string } }) {
  const { year, month } = await getActiveMonth()
  const consumptionYm = getConsumptionYm(year, month)

  const roomNumber = (() => {
    try {
      return decodeURIComponent(params.roomId)
    } catch {
      return params.roomId
    }
  })()
  const room = await prisma.room.findUnique({
    where: { number: roomNumber },
    include: { floor: true }
  })

  if (!room) {
    return <div className="p-4">Room not found: {roomNumber}</div>
  }

  const residency = await prisma.roomResident.findFirst({
    where: { roomNumber, active: true },
    orderBy: { startDate: 'desc' },
    include: { resident: true }
  })

  const roomMoves = await prisma.moveHistory.findMany({
    where: { roomNumber },
    select: { id: true, type: true, at: true, resident: { select: { fullName: true } } },
    orderBy: { at: 'desc' },
    take: 20
  })

  const versions = await prisma.billingVersion.findMany({
    where: { roomNumber, isActive: true },
    orderBy: [{ billingMonthId: 'desc' }, { versionNo: 'desc' }]
  })

  const monthIds = Array.from(new Set(versions.map((v) => v.billingMonthId)))
  const billingMonths = monthIds.length
    ? await prisma.billingMonth.findMany({
        where: { id: { in: monthIds } },
        select: { id: true, year: true, month: true }
      })
    : []
  const monthById = new Map(billingMonths.map((m) => [m.id, m]))

  const payments = await prisma.payment.findMany({
    where: { matches: { some: { billingRecord: { roomNumber } } } },
    orderBy: { occurredAt: 'desc' },
    take: 10
  })

  const docs = await prisma.documentVersion.findMany({
    where: { roomNumber },
    include: { billingMonth: true, template: true },
    orderBy: [{ generatedAt: 'desc' }],
    take: 10
  })

  const conversation = await prisma.conversation.findFirst({
    where: { roomNumber },
    select: { id: true },
    orderBy: { lastMessageAt: 'desc' }
  })

  const usageRows = await prisma.billingRecord.findMany({
    where: { roomNumber },
    select: { raw: true, billingMonth: { select: { year: true, month: true } } },
    orderBy: [{ billingMonth: { year: 'desc' } }, { billingMonth: { month: 'desc' } }],
    take: 6
  })

  const usageSeries = usageRows
    .map((row) => {
      const usage = readUsage(row.raw)
      return {
        ym: formatYm(row.billingMonth.year, row.billingMonth.month),
        water: usage.water,
        electric: usage.electric
      }
    })
    .reverse()

  const waterMax = Math.max(1, ...usageSeries.map((x) => x.water))
  const electricMax = Math.max(1, ...usageSeries.map((x) => x.electric))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Room {room.number}</h1>
          <div className="text-xs opacity-70">Billing Month: {formatYm(year, month)} | Consumption Period: {consumptionYm}</div>
        </div>
        <Link href={`/rooms/floor/${room.floor?.idx ?? ''}`} className="text-sm hover:text-primary">Back to Floor</Link>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="p-3 border erp-border rounded">
          <div className="text-sm opacity-80">Status</div>
          <div className="text-xl font-semibold">{room.status}</div>
          <div className="text-sm mt-1">Type: {room.type}</div>
          <div className="text-sm mt-2">Floor {room.floor?.idx} - {room.floor?.name}</div>
        </div>
        <div className="p-3 border erp-border rounded">
          <div className="text-sm opacity-80">Current Resident</div>
          <div className="text-xl font-semibold">{residency?.resident?.fullName ?? '-'}</div>
          <div className="text-sm mt-2">Start: {residency?.startDate?.toISOString().slice(0, 10) ?? '-'}</div>
          <div className="text-sm">End: {residency?.endDate ? residency.endDate.toISOString().slice(0, 10) : '-'}</div>
          <div className="mt-2">
            <Link
              href={conversation ? `/line?id=${conversation.id}` : '/line'}
              className="px-2 py-1 border erp-border rounded text-xs"
            >
              LINE Shortcut
            </Link>
          </div>
        </div>
      </div>

      <div className="p-3 border erp-border rounded">
        <div className="font-semibold mb-2">Activity Log</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b erp-border [&>th]:px-2 [&>th]:py-1 text-left">
              <th>Time</th>
              <th>Type</th>
              <th>Resident</th>
            </tr>
          </thead>
          <tbody>
            {roomMoves.map((m) => (
              <tr key={m.id} className="border-b erp-border [&>td]:px-2 [&>td]:py-1">
                <td>{m.at.toISOString().slice(0, 19).replace('T', ' ')}</td>
                <td>{m.type}</td>
                <td>{m.resident?.fullName ?? '-'}</td>
              </tr>
            ))}
            {roomMoves.length === 0 && (
              <tr><td colSpan={3} className="px-2 py-2 opacity-70">No activity</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-3 border erp-border rounded">
        <div className="font-semibold mb-2">Billing History (Active Versions)</div>
        <table className="w-full text-sm">
          <thead><tr><th className="text-left px-2 py-1">Month</th><th className="text-right px-2 py-1">Amount</th><th className="px-2 py-1">Version</th></tr></thead>
          <tbody>
            {versions.map((v) => {
              const bm = monthById.get(v.billingMonthId)
              return (
                <tr key={v.id} className="border-t erp-border">
                  <td className="px-2 py-1">{bm ? formatYm(bm.year, bm.month) : '-'}</td>
                  <td className="px-2 py-1 text-right">{Number(v.totalAmount ?? 0).toFixed(2)}</td>
                  <td className="px-2 py-1">{v.versionNo}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="p-3 border erp-border rounded">
        <div className="font-semibold mb-2">Payment History</div>
        <table className="w-full text-sm">
          <thead><tr><th className="text-left px-2 py-1">Date</th><th className="text-right px-2 py-1">Amount</th><th className="px-2 py-1">Ref</th></tr></thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-t erp-border">
                <td className="px-2 py-1">{payment.occurredAt.toISOString().slice(0, 19).replace('T', ' ')}</td>
                <td className="px-2 py-1 text-right">{Number(payment.amount).toFixed(2)}</td>
                <td className="px-2 py-1">{payment.bankRef ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-3 border erp-border rounded">
        <div className="font-semibold mb-2">Documents</div>
        <table className="w-full text-sm">
          <thead><tr><th className="text-left px-2 py-1">Template</th><th className="px-2 py-1">Month</th><th className="px-2 py-1">Version</th><th className="px-2 py-1">Status</th></tr></thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id} className="border-t erp-border">
                <td className="px-2 py-1">{doc.template.name}</td>
                <td className="px-2 py-1">{doc.billingMonth ? formatYm(doc.billingMonth.year, doc.billingMonth.month) : '-'}</td>
                <td className="px-2 py-1">{doc.versionNo}</td>
                <td className="px-2 py-1">{doc.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-3 border erp-border rounded space-y-3">
        <div className="font-semibold">Usage Graph (Last 6 Months)</div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="text-sm opacity-80">Water</div>
            {usageSeries.map((point) => (
              <div key={`w-${point.ym}`} className="space-y-1">
                <div className="text-xs flex justify-between"><span>{point.ym}</span><strong>{point.water.toFixed(0)}</strong></div>
                <div className="h-2 rounded bg-[var(--bg-surface)]">
                  <div className="h-2 rounded bg-cyan-500" style={{ width: `${Math.max(2, (point.water / waterMax) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="text-sm opacity-80">Electric</div>
            {usageSeries.map((point) => (
              <div key={`e-${point.ym}`} className="space-y-1">
                <div className="text-xs flex justify-between"><span>{point.ym}</span><strong>{point.electric.toFixed(0)}</strong></div>
                <div className="h-2 rounded bg-[var(--bg-surface)]">
                  <div className="h-2 rounded bg-amber-500" style={{ width: `${Math.max(2, (point.electric / electricMax) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
