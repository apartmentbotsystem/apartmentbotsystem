#!/usr/bin/env node
// Generate report/Apartment_ERP_Report.docx from report/Apartment_ERP_Report.md
// Requires: npm install --no-save docx marked

import fs from 'fs'
import path from 'path'
import { Document, Packer, Paragraph, HeadingLevel, TextRun, ImageRun } from 'docx'
import { marked } from 'marked'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const REPORT_DIR = path.resolve(process.cwd(), 'report')
const MD_FILE = path.join(REPORT_DIR, 'Apartment_ERP_Report.md')
const OUT_FILE = path.join(REPORT_DIR, 'Apartment_ERP_Report.docx')

function readMarkdown(fp) {
  return fs.readFileSync(fp, 'utf8')
}

function imagePathFromLink(src) {
  // handle relative paths
  return path.join(REPORT_DIR, src)
}

function createDocFromMarkdown(md) {
  const tokens = marked.lexer(md)
  const sections = []
  for (const token of tokens) {
    if (token.type === 'heading') {
      const level = token.depth
      const text = token.text
      let headingLevel = HeadingLevel.HEADING_1
      if (level === 2) headingLevel = HeadingLevel.HEADING_2
      else if (level === 3) headingLevel = HeadingLevel.HEADING_3
      sections.push(new Paragraph({ text, heading: headingLevel }))
    } else if (token.type === 'paragraph') {
      // Check for image markdown inside paragraph
      const inline = token.tokens || []
      for (const t of inline) {
        if (t.type === 'image') {
          const src = t.href
          const imgPath = imagePathFromLink(src)
          if (fs.existsSync(imgPath)) {
            const data = fs.readFileSync(imgPath)
            sections.push(new Paragraph({ children: [new ImageRun({ data, transformation: { width: 600, height: 300 } })] }))
          } else {
            sections.push(new Paragraph({ children: [new TextRun('[' + t.text + '](' + src + ') - (image not found)')] }))
          }
        } else if (t.type === 'text') {
          sections.push(new Paragraph({ text: t.text }))
        }
      }
      if (!inline || inline.length === 0) {
        sections.push(new Paragraph({ text: token.text || '' }))
      }
    } else if (token.type === 'code') {
      // code block
      sections.push(new Paragraph({ children: [new TextRun({ text: token.text })] }))
    } else if (token.type === 'list') {
      for (const item of token.items) {
        sections.push(new Paragraph({ text: item.text }))
      }
    }
  }
  const doc = new Document({ sections: [{ properties: {}, children: sections }] })
  return doc
}

function main() {
  if (!fs.existsSync(MD_FILE)) {
    console.error('Markdown file not found:', MD_FILE)
    process.exit(1)
  }
  const md = readMarkdown(MD_FILE)
  const doc = createDocFromMarkdown(md)
  Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync(OUT_FILE, buffer)
    console.log('✓ Wrote', OUT_FILE)
  }).catch((err) => {
    console.error('✗ Error creating docx:', err)
    process.exit(1)
  })
}

main()
