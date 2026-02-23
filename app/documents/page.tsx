import Link from 'next/link'
import { DocumentStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getActiveMonth } from '@/lib/context'
import { hashBillingSnapshot, readDocumentSnapshotMeta } from '@/domain/document/integrity'

type Params = {
  floor?: string
  status?: string
  version?: string
}

export default async function DocumentsPage({ searchParams }: { searchParams?: Params }) {
  const { year, month } = await getActiveMonth()
  const consumptionDate = new Date(year, month - 2, 1)
  const consumptionYm = `${consumptionDate.getFullYear()}-${String(consumptionDate.getMonth() + 1).padStart(2, '0')}`

  const floorIdx = Number(searchParams?.floor ?? '')
  const versionNo = Number(searchParams?.version ?? '')
  const statusInput = String(searchParams?.status ?? '').trim().toUpperCase()
  const status = Object.values(DocumentStatus).includes(statusInput as DocumentStatus)
    ? (statusInput as DocumentStatus)
    : undefined

  const floors = await prisma.floor.findMany({ orderBy: { idx: 'asc' }, select: { idx: true, name: true } })

  const billingMonth = await prisma.billingMonth.findFirst({ where: { year, month }, select: { id: true } })

  const docs = await prisma.documentVersion.findMany({
    where: {
      billingMonth: { year, month },
      ...(Number.isFinite(floorIdx) ? { room: { floor: { idx: floorIdx } } } : {}),
      ...(status ? { status } : {}),
      ...(Number.isFinite(versionNo) ? { versionNo } : {})
    },
    select: {
      id: true,
      roomNumber: true,
      templateGroupId: true,
      status: true,
      versionNo: true,
      generatedAt: true,
      snapshotJson: true,
      room: { select: { floor: { select: { idx: true } } } }
    },
    orderBy: [{ generatedAt: 'desc' }]
  })

  const activeByRoom = new Map<string, string>()
  if (billingMonth?.id) {
    const actives = await prisma.billingVersion.findMany({
      where: { billingMonthId: billingMonth.id, isActive: true },
      select: { roomNumber: true, snapshotData: true, totalAmount: true }
    })
    for (const row of actives) {
      activeByRoom.set(row.roomNumber, hashBillingSnapshot(row.snapshotData, Number(row.totalAmount)))
    }
  }

  const statuses = ['DRAFT', 'READY', 'SENT', 'FAILED', 'CANCELED'] as const

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold">เอกสาร</h1>
        <div className="text-xs opacity-70">รอบบิล: {year}-{String(month).padStart(2, '0')} | รอบใช้หน่วย: {consumptionYm}</div>
      </div>

      <form className="border erp-border rounded p-2 grid gap-2 md:grid-cols-4 text-sm" method="GET">
        <select name="floor" defaultValue={Number.isFinite(floorIdx) ? String(floorIdx) : ''} className="border erp-border rounded px-2 py-1">
          <option value="">ทุกชั้น</option>
          {floors.map((f) => (<option key={f.idx} value={f.idx}>ชั้น {f.idx} ({f.name})</option>))}
        </select>
        <select name="status" defaultValue={status ?? ''} className="border erp-border rounded px-2 py-1">
          <option value="">ทุกสถานะ</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input name="version" defaultValue={Number.isFinite(versionNo) ? String(versionNo) : ''} placeholder="เวอร์ชัน" className="border erp-border rounded px-2 py-1" />
        <button type="submit" className="px-2 py-1 border erp-border rounded">กรองข้อมูล</button>
      </form>

      <div className="overflow-auto border erp-border rounded">
        <table className="w-full text-sm min-w-[980px]">
          <thead><tr className="[&>th]:px-2 [&>th]:py-2 border-b erp-border text-left"><th>วันที่สร้าง</th><th>ชั้น</th><th>ห้อง</th><th>เวอร์ชัน</th><th>กลุ่มเทมเพลต</th><th>สถานะ</th><th>ความถูกต้อง</th><th>การทำงาน</th></tr></thead>
          <tbody>
            {docs.map((doc) => {
              const meta = readDocumentSnapshotMeta(doc.snapshotJson)
              const activeHash = activeByRoom.get(doc.roomNumber)
              const changedAfterSend = Boolean(meta.billingHash && activeHash && meta.billingHash !== activeHash)
              return (
                <tr key={doc.id} className="[&>td]:px-2 [&>td]:py-1 border-b erp-border align-top">
                  <td>{doc.generatedAt.toISOString().slice(0, 10)}</td>
                  <td>{doc.room.floor?.idx ?? '-'}</td>
                  <td>{doc.roomNumber}</td>
                  <td>v{doc.versionNo}</td>
                  <td>{doc.templateGroupId ?? meta.templateGroupId ?? '-'}</td>
                  <td><span className="chip">{doc.status}</span></td>
                  <td>{changedAfterSend ? <span className="chip">มีการเปลี่ยนหลังส่ง</span> : <span className="chip">OK</span>}</td>
                  <td><Link className="px-2 py-1 border erp-border rounded text-xs" href={`/api/documents/${doc.id}/verify`} target="_blank">ตรวจสอบ</Link></td>
                </tr>
              )
            })}
            {docs.length === 0 && <tr><td colSpan={8} className="px-2 py-6 text-center opacity-70">ไม่พบเอกสารตามตัวกรองที่เลือก</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
