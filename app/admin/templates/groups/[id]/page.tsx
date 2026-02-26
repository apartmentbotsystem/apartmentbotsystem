import { prisma } from '@/lib/db'
import { createDraft, publishTemplate } from '@/domain/template/service'
import { getAllowedPlaceholders, validateTemplateContent } from '@/domain/template/placeholderRegistry'
import { Prisma } from '@prisma/client'
import type { Template } from '@prisma/client'
import RichTemplateEditor from './rich-template-editor'
import PageContainer from '@/components/system/PageContainer'
import PageHeader from '@/components/system/PageHeader'
import SectionCard from '@/components/system/SectionCard'

function inferInitialHtml(contentJson: unknown): string {
  if (!contentJson || typeof contentJson !== 'object' || Array.isArray(contentJson)) {
    return '<p>Type template content here...</p>'
  }
  const obj = contentJson as Record<string, unknown>
  const html = obj['html']
  if (typeof html === 'string' && html.trim()) return html
  return '<p>Type template content here...</p>'
}

export default async function GroupDetail({ params }: { params: { id: string } }) {
  const group = await prisma.templateGroup.findUnique({ where: { id: params.id } })
  if (!group) return <div>Group not found</div>
  const groupType = group.type
  const templates = await prisma.template.findMany({ where: { groupId: group.id }, orderBy: { version: 'desc' }, take: 200 })
  const allowedPlaceholders = getAllowedPlaceholders(groupType)

  async function saveTemplateRich(formData: FormData) {
    'use server'
    const templateId = String(formData.get('templateId') ?? '')
    const html = String(formData.get('html') ?? '')
    if (!templateId) return
    const found = new Set<string>()
    const re = /\{\{\s*([a-zA-Z0-9._-]+)\s*\}\}/g
    let m: RegExpExecArray | null = null
    while ((m = re.exec(html))) {
      if (m[1]) found.add(m[1])
    }
    const contentJson: Prisma.InputJsonValue = {
      kind: 'rich_html_v1',
      html,
      placeholders: [...found].map((placeholder) => ({ placeholder }))
    }
    validateTemplateContent(groupType, contentJson)
    await prisma.template.update({
      where: { id: templateId },
      data: { contentJson }
    })
  }

  async function publishTemplateAction(formData: FormData) {
    'use server'
    const templateId = String(formData.get('templateId') ?? '')
    if (!templateId) return
    await publishTemplate(templateId)
  }

  return (
    <PageContainer>
      <PageHeader title={`${group.name} [${group.type}]`} />
      <div className="space-y-4 mt-4">
        <SectionCard title="Actions">
          <form action={async () => { 'use server'; await createDraft(group.id) }}>
            <button type="submit" className="px-3 py-1 border erp-border rounded">Create Draft</button>
          </form>
        </SectionCard>
        <div className="space-y-4">
          {templates.map((t: Template) => (
            <SectionCard key={t.id} title={`Template v${t.version} ${t.isDraft ? '(Draft)' : ''}`} actions={<span className="chip">{t.isPublished ? 'Published' : 'Unpublished'}</span>}>
              <RichTemplateEditor
                templateId={t.id}
                version={t.version}
                isPublished={t.isPublished}
                isDraft={t.isDraft}
                initialHtml={inferInitialHtml(t.contentJson)}
                allowedPlaceholders={allowedPlaceholders}
                onSave={saveTemplateRich}
                onPublish={publishTemplateAction}
              />
            </SectionCard>
          ))}
        </div>
      </div>
    </PageContainer>
  )
}
