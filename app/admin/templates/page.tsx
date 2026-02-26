import { prisma } from '@/lib/db'
import { TemplateType, type TemplateGroup } from '@prisma/client'
import Link from 'next/link'
import PageContainer from '@/components/system/PageContainer'
import PageHeader from '@/components/system/PageHeader'
import SectionCard from '@/components/system/SectionCard'

export const dynamic = 'force-dynamic'

export default async function TemplateGroupsPage() {
  const groups = await prisma.templateGroup.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
  return (
    <PageContainer>
      <PageHeader title="Template Groups" />
      <div className="space-y-4 mt-4">
        <SectionCard title="Create Group">
          <form
            className="flex items-end gap-2 text-sm"
            action={async (formData: FormData) => {
              'use server'
              const name = String(formData.get('name') ?? '')
              const typeRaw = String(formData.get('type') ?? 'BILLING')
              const type = Object.values(TemplateType).includes(typeRaw as TemplateType) ? (typeRaw as TemplateType) : TemplateType.BILLING
              if (!name) return
              await prisma.templateGroup.create({ data: { name, type } })
            }}
          >
            <div>
              <label className="block text-xs">Group name</label>
              <input name="name" placeholder="Group name" className="border erp-border rounded px-2 py-1" />
            </div>
            <div>
              <label className="block text-xs">Type</label>
              <select name="type" defaultValue="BILLING" className="border erp-border rounded px-2 py-1">
                <option value="BILLING">BILLING</option>
                <option value="RECEIPT">RECEIPT</option>
                <option value="NOTICE">NOTICE</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>
            <button type="submit" className="px-3 py-1 border erp-border rounded">Create Group</button>
          </form>
        </SectionCard>
        <SectionCard title="Groups">
          <ul className="text-sm space-y-2">
            {groups.map((g: TemplateGroup) => (
              <li key={g.id} className="flex items-center justify-between border erp-border rounded px-3 py-2">
                <div><strong>{g.name}</strong> <span className="chip ml-2">{g.type}</span></div>
                <Link href={`/admin/templates/groups/${g.id}`} className="px-2 py-1 border erp-border rounded text-xs">เปิด</Link>
              </li>
            ))}
            {groups.length === 0 && <li className="opacity-70 text-sm">ยังไม่มีกลุ่มเทมเพลต</li>}
          </ul>
        </SectionCard>
      </div>
    </PageContainer>
  )
}
