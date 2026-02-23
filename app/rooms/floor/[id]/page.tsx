import { prisma } from '@/lib/db'
import Link from 'next/link'
import { compareRoomNumbersNatural } from '@/lib/room-sort'

export default async function FloorRoomsPage({ params }: { params: { id: string } }) {
  const idx = Number(params.id)
  const floor = await prisma.floor.findFirst({ where: { idx }, select: { id: true, idx: true, name: true } })

  if (!floor) {
    return <div className="p-4">Floor not found: {idx}</div>
  }

  const rooms = await prisma.room.findMany({
    where: { floorId: floor.id },
    select: { number: true, status: true, tenantId: true }
  })

  rooms.sort((a, b) => compareRoomNumbersNatural(a.number, b.number))

  const statusColor: Record<string, string> = {
    VACANT: 'bg-green-50 border-green-200',
    OCCUPIED: 'bg-yellow-50 border-yellow-200',
    MAINTENANCE: 'bg-orange-50 border-orange-200',
    SELF_USE: 'bg-slate-50 border-slate-200'
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Floor {floor.idx} - {floor.name}</h1>
        <Link href="/rooms" className="text-sm hover:text-primary">Back to Rooms</Link>
      </div>
      <div className="grid gap-2 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        {rooms.map((r) => (
          <Link key={r.number} href={`/rooms/${encodeURIComponent(r.number)}`} className={`p-3 border rounded text-sm ${statusColor[r.status] ?? 'bg-[var(--bg-surface)] erp-border'}`}>
            <div className="font-semibold">{r.number}</div>
            <div className="opacity-80 text-xs">{r.status}</div>
            <div className="text-xs mt-1">{r.tenantId ?? '-'}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
