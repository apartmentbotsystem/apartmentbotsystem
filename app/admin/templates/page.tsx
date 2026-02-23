import { prisma } from '@/lib/db'
import { TemplateType, type TemplateGroup } from '@prisma/client'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function TemplateGroupsPage() {
  const groups = await prisma.templateGroup.findMany({ orderBy: { createdAt: 'desc' } })
  return (
    <div style={{ padding: 16 }}>
      <h1>Template Groups</h1>
      <form action={async (formData: FormData) => {
        'use server'
        const name = String(formData.get('name') ?? '')
        const typeRaw = String(formData.get('type') ?? 'BILLING')
        const type = Object.values(TemplateType).includes(typeRaw as TemplateType) ? (typeRaw as TemplateType) : TemplateType.BILLING
        if (!name) return
        await prisma.templateGroup.create({ data: { name, type } })
      }}>
        <input name="name" placeholder="Group name" />
        <select name="type" defaultValue="BILLING">
          <option value="BILLING">BILLING</option>
          <option value="RECEIPT">RECEIPT</option>
          <option value="NOTICE">NOTICE</option>
          <option value="OTHER">OTHER</option>
        </select>
        <button type="submit">Create Group</button>
      </form>
      <ul>
        {groups.map((g: TemplateGroup) => (
          <li key={g.id}>
            <Link href={`/admin/templates/groups/${g.id}`}>{g.name} [{g.type}]</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
