import { prisma } from '@/lib/db'
import { createDraft, publishTemplate } from '@/domain/template/service'
import { validateTemplateContent } from '@/domain/template/placeholderRegistry'
import type { Template } from '@prisma/client'

export default async function GroupDetail({ params }: { params: { id: string } }) {
  const group = await prisma.templateGroup.findUnique({ where: { id: params.id } })
  if (!group) return <div>Group not found</div>
  const templates = await prisma.template.findMany({ where: { groupId: group.id }, orderBy: { version: 'desc' } })
  return (
    <div style={{ padding: 16 }}>
      <h1>{group.name} [{group.type}]</h1>
      <form action={async () => { 'use server'; await createDraft(group.id) }}>
        <button type="submit">Create Draft</button>
      </form>
      <ul>
        {templates.map((t: Template) => (
          <li key={t.id}>
            v{t.version} {t.isPublished ? '(published)' : t.isDraft ? '(draft)' : '' }
            <form action={async (formData: FormData) => {
              'use server'
              const content = String(formData.get('content') ?? '{}')
              const json = JSON.parse(content)
              validateTemplateContent(group.type as any, json)
              await prisma.template.update({ where: { id: t.id }, data: { contentJson: json } })
            }}>
              <textarea name="content" defaultValue={JSON.stringify(t.contentJson, null, 2)} rows={8} cols={80} />
              <button type="submit">Save JSON</button>
            </form>
            {!t.isPublished && (
              <form action={async () => { 'use server'; await publishTemplate(t.id) }}>
                <button type="submit">Publish</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
