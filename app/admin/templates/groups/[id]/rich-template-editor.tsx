'use client'

import { useMemo, useRef, useState } from 'react'

type Props = {
  templateId: string
  version: number
  isPublished: boolean
  isDraft: boolean
  initialHtml: string
  allowedPlaceholders: string[]
  onSave: (formData: FormData) => Promise<void>
  onPublish: (formData: FormData) => Promise<void>
}

function highlightPlaceholders(html: string): string {
  return html.replace(/\{\{\s*([a-zA-Z0-9._-]+)\s*\}\}/g, (_m, key: string) => {
    return `<span style="background: #fff3cd; border: 1px solid #ffe08a; border-radius: 6px; padding: 0 4px;">{{${key}}}</span>`
  })
}

function previewValueFor(key: string): string {
  const map: Record<string, string> = {
    'room.number': '798/1',
    'tenant.name': 'Somchai Jaidee',
    'billing.month': '2026-04',
    'billing.total': '12,345.00',
    'billing.water': '1,250.00',
    'billing.electric': '2,450.00',
    'receipt.total': '12,345.00',
    'notice.message': 'Please pay within due date'
  }
  return map[key] ?? `[${key}]`
}

function replacePlaceholdersWithSample(html: string): string {
  return html.replace(/\{\{\s*([a-zA-Z0-9._-]+)\s*\}\}/g, (_m, key: string) => previewValueFor(key))
}

export default function RichTemplateEditor(props: Props) {
  const {
    templateId,
    version,
    isPublished,
    isDraft,
    initialHtml,
    allowedPlaceholders,
    onSave,
    onPublish
  } = props
  const editorRef = useRef<HTMLDivElement | null>(null)
  const [html, setHtml] = useState(initialHtml)
  const [showHtmlMode, setShowHtmlMode] = useState(false)
  const [showRenderedPreview, setShowRenderedPreview] = useState(true)

  const status = useMemo(() => {
    if (isPublished) return 'published'
    if (isDraft) return 'draft'
    return 'saved'
  }, [isDraft, isPublished])

  const runCmd = (cmd: string, value?: string) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, value)
    setHtml(editorRef.current?.innerHTML ?? '')
  }

  const insertPlaceholder = (placeholder: string) => {
    runCmd('insertText', `{{${placeholder}}}`)
  }

  const insertTable = () => {
    const table = `
      <table style="width:100%; border-collapse: collapse; margin: 8px 0;">
        <tr><th style="border:1px solid #ccc; padding:4px;">Column 1</th><th style="border:1px solid #ccc; padding:4px;">Column 2</th><th style="border:1px solid #ccc; padding:4px;">Column 3</th></tr>
        <tr><td style="border:1px solid #ccc; padding:4px;">Value</td><td style="border:1px solid #ccc; padding:4px;">Value</td><td style="border:1px solid #ccc; padding:4px;">Value</td></tr>
        <tr><td style="border:1px solid #ccc; padding:4px;">Value</td><td style="border:1px solid #ccc; padding:4px;">Value</td><td style="border:1px solid #ccc; padding:4px;">Value</td></tr>
      </table>
    `.trim()
    runCmd('insertHTML', table)
  }

  return (
    <div className="border erp-border rounded p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">v{version}</div>
        <span className="chip">{status}</span>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <button type="button" className="px-2 py-1 border erp-border rounded" onClick={() => runCmd('undo')}>Undo</button>
        <button type="button" className="px-2 py-1 border erp-border rounded" onClick={() => runCmd('redo')}>Redo</button>
        <button type="button" className="px-2 py-1 border erp-border rounded" onClick={() => runCmd('bold')}>Bold</button>
        <button type="button" className="px-2 py-1 border erp-border rounded" onClick={() => runCmd('italic')}>Italic</button>
        <button type="button" className="px-2 py-1 border erp-border rounded" onClick={() => runCmd('underline')}>Underline</button>
        <button type="button" className="px-2 py-1 border erp-border rounded" onClick={() => runCmd('formatBlock', 'h2')}>H2</button>
        <button type="button" className="px-2 py-1 border erp-border rounded" onClick={() => runCmd('formatBlock', 'p')}>Paragraph</button>
        <button type="button" className="px-2 py-1 border erp-border rounded" onClick={() => runCmd('insertUnorderedList')}>Bullet</button>
        <button type="button" className="px-2 py-1 border erp-border rounded" onClick={() => runCmd('insertOrderedList')}>Numbered</button>
        <button type="button" className="px-2 py-1 border erp-border rounded" onClick={() => runCmd('justifyLeft')}>Left</button>
        <button type="button" className="px-2 py-1 border erp-border rounded" onClick={() => runCmd('justifyCenter')}>Center</button>
        <button type="button" className="px-2 py-1 border erp-border rounded" onClick={() => runCmd('justifyRight')}>Right</button>
        <button type="button" className="px-2 py-1 border erp-border rounded" onClick={insertTable}>Insert Table</button>
        <button type="button" className="px-2 py-1 border erp-border rounded" onClick={() => runCmd('removeFormat')}>Clear Format</button>
        <button type="button" className="px-2 py-1 border erp-border rounded" onClick={() => setShowHtmlMode((v) => !v)}>
          {showHtmlMode ? 'WYSIWYG' : 'HTML'}
        </button>
      </div>

      <div className="text-xs opacity-75">Allowed placeholders</div>
      <div className="flex flex-wrap gap-2">
        {allowedPlaceholders.map((key) => (
          <button
            key={key}
            type="button"
            className="px-2 py-1 border erp-border rounded text-xs"
            onClick={() => insertPlaceholder(key)}
          >
            {`{{${key}}}`}
          </button>
        ))}
      </div>

      {showHtmlMode ? (
        <textarea
          value={html}
          onChange={(e) => setHtml(e.currentTarget.value)}
          className="min-h-[220px] w-full border erp-border rounded p-3 text-sm bg-[var(--bg-page)] font-mono"
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="min-h-[220px] border erp-border rounded p-3 text-sm bg-[var(--bg-page)]"
          dangerouslySetInnerHTML={{ __html: html }}
          onInput={(e) => setHtml((e.currentTarget as HTMLDivElement).innerHTML)}
        />
      )}

      <form action={onSave} className="flex items-center gap-2">
        <input type="hidden" name="templateId" value={templateId} />
        <input type="hidden" name="html" value={html} />
        <button type="submit" className="px-2 py-1 border erp-border rounded text-sm">Save</button>
      </form>

      {!isPublished && (
        <form action={onPublish}>
          <input type="hidden" name="templateId" value={templateId} />
          <button type="submit" className="px-2 py-1 border erp-border rounded text-sm">Publish</button>
        </form>
      )}

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="text-xs opacity-75">Preview</div>
          <button
            type="button"
            className="px-2 py-0.5 border erp-border rounded text-xs"
            onClick={() => setShowRenderedPreview((v) => !v)}
          >
            {showRenderedPreview ? 'Show Placeholder View' : 'Show Sample Data View'}
          </button>
        </div>
        <div
          className="min-h-[120px] border erp-border rounded p-3 text-sm bg-[var(--bg-surface)]"
          dangerouslySetInnerHTML={{
            __html: showRenderedPreview
              ? replacePlaceholdersWithSample(html)
              : highlightPlaceholders(html)
          }}
        />
      </div>
    </div>
  )
}
