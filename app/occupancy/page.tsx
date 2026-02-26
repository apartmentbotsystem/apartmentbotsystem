import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { compareRoomNumbersNatural } from '@/lib/room-sort'
import MoveInWizard from './move-in-wizard'
import { getActiveMonth } from '@/lib/context'
import { formatYm, getConsumptionYm } from '@/lib/datetime'

function formatDateInput(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default async function OccupancyPage() {
  const { year, month } = await getActiveMonth()
  const consumptionYm = getConsumptionYm(year, month)

  const rooms = await prisma.room.findMany({
    include: {
      floor: true,
      occupants: { where: { active: true }, include: { resident: true } },
      contracts: { where: { active: true }, include: { primaryResident: true } }
    }
  })

  rooms.sort((a, b) => {
    if ((a.floor?.idx ?? 0) !== (b.floor?.idx ?? 0)) return (a.floor?.idx ?? 0) - (b.floor?.idx ?? 0)
    return compareRoomNumbersNatural(a.number, b.number)
  })

  const vacantห้องพัก = rooms
    .filter((r) => r.status === 'VACANT')
    .map((r) => ({ roomNumber: r.number, floorIdx: r.floor?.idx ?? null }))

  async function moveOut(formData: FormData) {
    'use server'
    const roomNumber = String(formData.get('roomNumber') ?? '').trim()
    const moveOutDateRaw = String(formData.get('moveOutDate') ?? '').trim()
    const note = String(formData.get('note') ?? '').trim()
    const generateFinalInvoice = String(formData.get('generateFinalInvoice') ?? '') === 'on'
    if (!roomNumber || !moveOutDateRaw) return
    const moveOutDate = new Date(moveOutDateRaw)

    await prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { number: roomNumber } })
      if (!room) return

      const activeResidents = await tx.roomResident.findMany({ where: { roomNumber, active: true } })
      for (const rr of activeResidents) {
        await tx.roomResident.update({
          where: { id: rr.id },
          data: { active: false, endDate: moveOutDate }
        })
        const flags = [
          note ? `note=${note}` : '',
          generateFinalInvoice ? 'finalInvoice=YES' : ''
        ].filter(Boolean).join(';')
        await tx.moveHistory.create({
          data: {
            roomNumber,
            residentId: rr.residentId,
            type: flags ? `MOVE_OUT:${flags}` : 'MOVE_OUT',
            at: moveOutDate
          }
        })
      }

      await tx.contract.updateMany({
        where: { roomNumber, active: true },
        data: { active: false, endDate: moveOutDate }
      })

      await tx.lineBinding.deleteMany({ where: { roomNumber } })
      await tx.conversation.updateMany({
        where: { roomNumber },
        data: { roomNumber: null }
      })

      await tx.room.update({ where: { number: roomNumber }, data: { status: 'VACANT' } })
    })

    revalidatePath('/occupancy')
    revalidatePath('/rooms')
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Occupancy (ย้ายเข้า / ย้ายออก)</h1>
      <div className="text-xs opacity-70">บิล เดือน: {formatYm(year, month)} | รอบใช้หน่วย: {consumptionYm}</div>

      <MoveInWizard rooms={vacantห้องพัก} />

      <section className="border erp-border rounded p-3 space-y-2">
        <h2 className="font-semibold">รายการการเข้าอยู่รายห้อง</h2>
        <div className="overflow-auto border erp-border rounded">
          <table className="w-full text-xs min-w-[980px]">
            <thead>
              <tr className="[&>th]:px-2 [&>th]:py-2 border-b erp-border">
                <th>Floor</th>
                <th>Room</th>
                <th>สถานะ</th>
                <th>ผู้เช่าหลัก</th>
                <th>จำนวนผู้อยู่อาศัย</th>
                <th>เริ่มสัญญา</th>
                <th>สิ้นสุดสัญญา</th>
                <th>ย้ายออก</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => {
                const primary = r.occupants.find((o) => o.role === 'PRIMARY')
                const activeContract = r.contracts[0]
                return (
                  <tr key={r.number} className="[&>td]:px-2 [&>td]:py-1 border-b erp-border align-top">
                    <td>{r.floor?.idx ?? '-'}</td>
                    <td>{r.number}</td>
                    <td>{r.status}</td>
                    <td>{primary?.resident?.fullName ?? '-'}</td>
                    <td>{r.occupants.length}</td>
                    <td>{activeContract?.startDate ? activeContract.startDate.toISOString().slice(0, 10) : '-'}</td>
                    <td>{activeContract?.endDate ? activeContract.endDate.toISOString().slice(0, 10) : '-'}</td>
                    <td>
                      {r.status === 'OCCUPIED' ? (
                        <form action={moveOut} className="grid gap-1">
                          <input type="hidden" name="roomNumber" value={r.number} />
                          <input name="moveOutDate" type="date" defaultValue={formatDateInput(new Date())} className="border erp-border rounded px-1 py-0.5" required />
                          <input name="note" placeholder="หมายเหตุ" className="border erp-border rounded px-1 py-0.5" />
                          <label className="flex items-center gap-1 text-[11px]">
                            <input type="checkbox" name="generateFinalInvoice" />
                            ออกบิลสุดท้าย
                          </label>
                          <button type="submit" className="px-2 py-0.5 border erp-border rounded">ย้ายออก</button>
                        </form>
                      ) : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}


