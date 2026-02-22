import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { DomainError } from '@/domain/errors'

export function renderDocx(template: Buffer, data: Record<string, unknown>): Buffer {
  try {
    const zip = new PizZip(template)
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })
    doc.render(data)
    const out = doc.getZip().generate({ type: 'nodebuffer' })
    return out
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Document render failed'
    throw new DomainError('DOC_RENDER_FAILED', message, 500)
  }
}
