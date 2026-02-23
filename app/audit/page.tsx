import { prisma } from '@/lib/db'

export default async function AuditPage({
  searchParams
}: {
  searchParams: { entity?: string; action?: string }
}) {
  const where = {
    ...(searchParams.entity ? { entityType: searchParams.entity } : {}),
    ...(searchParams.action ? { action: searchParams.action } : {})
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 300
  })

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">บันทึกตรวจสอบ</h1>
      <form className="flex gap-2 items-end">
        <div className="grid gap-1">
          <label className="text-xs">เอนทิตี</label>
          <input name="entity" defaultValue={searchParams.entity ?? ''} className="border erp-border rounded px-2 py-1" />
        </div>
        <div className="grid gap-1">
          <label className="text-xs">การทำงาน</label>
          <input name="action" defaultValue={searchParams.action ?? ''} className="border erp-border rounded px-2 py-1" />
        </div>
        <button type="submit" className="px-3 py-1 border erp-border rounded">กรอง</button>
      </form>
      <div className="overflow-auto border erp-border rounded">
        <table className="w-full text-xs min-w-[900px]">
          <thead>
            <tr className="[&>th]:px-2 [&>th]:py-2 border-b erp-border">
              <th>ผู้ใช้</th>
              <th>การทำงาน</th>
              <th>เอนทิตี</th>
              <th>รหัสเอนทิตี</th>
              <th>ข้อมูล</th>
              <th>เวลา</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="[&>td]:px-2 [&>td]:py-1 border-b erp-border align-top">
                <td>{log.tenantId ?? '-'}</td>
                <td>{log.action}</td>
                <td>{log.entityType}</td>
                <td className="max-w-[180px] truncate">{log.entityId}</td>
                <td className="max-w-[360px] truncate">{JSON.stringify(log.data ?? {})}</td>
                <td>{log.createdAt.toISOString().slice(0, 19).replace('T', ' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
