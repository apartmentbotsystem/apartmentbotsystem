import assert from 'node:assert/strict'
import PizZip from 'pizzip'
import { renderDocx } from '@/lib/docx'

function makeMinimalTemplateWithPlaceholder(): Buffer {
  const zip = new PizZip()
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  )
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  )
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Hello {name}</w:t></w:r></w:p>
  </w:body>
</w:document>`
  )
  return zip.generate({ type: 'nodebuffer' }) as Buffer
}

async function main() {
  const tpl = makeMinimalTemplateWithPlaceholder()
  const out = renderDocx(tpl, { name: 'World' })
  const zip = new PizZip(out)
  const file = zip.file('word/document.xml')
  const xml = file ? file.asText() : ''
  assert.equal(xml.includes('Hello World'), true, 'placeholder replaced')
  assert.equal(xml.includes('{name}'), false, 'placeholder not present')
  console.log('docx.render tests passed')
}

await main()
