import { prisma } from '@/lib/db'
import { generateDocumentVersionBatch } from '@/domain/document/versioning'
import type { TemplateGroup, BillingMonth, Room } from '@prisma/client'

export default async function GeneratePage() {
  const groups = await prisma.templateGroup.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' } })
  const months = await prisma.billingMonth.findMany({ orderBy: [{ year: 'desc' }, { month: 'desc' }] })
  const rooms = await prisma.room.findMany({ orderBy: { number: 'asc' } })
  return (
    <div style={{ padding: 16 }}>
      <h1>Generate Documents</h1>
      <form action={async (formData: FormData) => {
        'use server'
        const billingMonthId = String(formData.get('billingMonthId') ?? '')
        const templateGroupId = String(formData.get('templateGroupId') ?? '')
        const selectedRooms = (formData.getAll('room') as string[])
        const actorId = 'admin'
        const payload = selectedRooms.map(rn => ({ roomId: rn, billingMonth: billingMonthId, templateGroupId, actorId }))
        await generateDocumentVersionBatch(payload)
      }}>
        <label>Month: </label>
        <select name="billingMonthId">
          {months.map((m: BillingMonth) => (
            <option key={m.id} value={m.id}>{m.year}-{String(m.month).padStart(2, '0')}</option>
          ))}
        </select>
        <label> Template Group: </label>
        <select name="templateGroupId">
          {groups.map((g: TemplateGroup) => (
            <option key={g.id} value={g.id}>{g.name} [{g.type}]</option>
          ))}
        </select>
        <div style={{ marginTop: 12 }}>
          <div>Rooms</div>
          <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid #ccc', padding: 8 }}>
            {rooms.map((r: Room) => (
              <label key={r.number} style={{ display: 'block' }}>
                <input type="checkbox" name="room" value={r.number} /> {r.number}
              </label>
            ))}
          </div>
        </div>
        <button type="submit" style={{ marginTop: 12 }}>Generate</button>
      </form>
    </div>
  )
}
