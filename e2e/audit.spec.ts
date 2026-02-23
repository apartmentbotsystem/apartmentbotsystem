import { test, expect } from '@playwright/test'
import { loginAs, getCsrfToken } from './utils'
import * as XLSX from 'xlsx'
import { readFileSync } from 'node:fs'

const REQUIRED_HEADERS = [
  'เดือน',
  'ห้อง',
  'ชื่อบัญชี',
  'ธนาคาร',
  'หมายเลขบัญชี',
  'ค่าเช่า',
  'น้ำก่อน',
  'น้ำหลัง',
  'ใช้น้ำ',
  'ค่าน้ำต่อหน่วย',
  'ค่าบริการมิเตอร์น้ำ',
  'รวมค่าน้ำ',
  'ไฟก่อน',
  'ไฟหลัง',
  'ใช้ไฟ',
  'ค่าไฟต่อหน่วย',
  'ค่าบริการมิเตอร์ไฟ',
  'รวมค่าไฟ',
  'เฟอร์',
  'อื่นๆ',
  'รวมเงิน',
  'หมายเหตุ'
]

function normalizeHeader(s: unknown): string {
  return String(s ?? '')
    .replace(/\u00A0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function toNumber(raw: unknown): number {
  if (raw == null) return 0
  const s = String(raw).replace(/[,\s฿]/g, '')
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

test('financial audit: DATA-TEST import + document + audit log', async ({ page }) => {
  test.setTimeout(120000)
  await loginAs(page, 'SUPER_ADMIN')
  const csrf = await getCsrfToken(page)

  const xlsxPath = 'd:/apartmentproject/DATA-TEST.xlsx'
  const wb = XLSX.read(readFileSync(xlsxPath), { type: 'buffer' })
  expect(wb.SheetNames.length).toBe(8)

  const firstSheet = wb.SheetNames[0]!
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[firstSheet], { header: 1 })
  expect(rows.length).toBeGreaterThan(1)

  const headers = (rows[0] ?? []).map(normalizeHeader)
  expect(headers.length).toBeGreaterThanOrEqual(REQUIRED_HEADERS.length)
  for (const required of REQUIRED_HEADERS) {
    expect(headers.includes(required)).toBeTruthy()
  }

  const monthCol = headers.indexOf('เดือน')
  let targetYear = new Date().getFullYear()
  let targetMonth = new Date().getMonth() + 1
  const monthCell = String(rows[1]?.[monthCol] ?? '')
  const ym = monthCell.match(/(\d{4}).*?(\d{1,2})/)
  if (ym) {
    targetYear = Number(ym[1])
    targetMonth = Number(ym[2])
  }

  const fileBase64 = readFileSync(xlsxPath).toString('base64')
  const importRes = await page.request.post('/api/billing/import', {
    headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
    data: { filename: 'DATA-TEST.xlsx', fileBase64, year: targetYear, month: targetMonth, strict: true }
  })
  if (importRes.status() !== 409) {
    expect(importRes.ok()).toBeTruthy()
    const body = await importRes.json() as { ok: boolean; status?: string }
    expect(body.ok).toBeTruthy()
    expect(body.status).toBe('SUCCESS')
  }

  const recordsRes = await page.request.get(`/api/billing/records?year=${targetYear}&month=${targetMonth}`, {
    headers: { 'x-csrf-token': csrf }
  })
  expect(recordsRes.ok()).toBeTruthy()
  const recordsJson = await recordsRes.json() as { items: Array<{ roomNumber: string; amount: number }> }
  expect(recordsJson.items.length).toBeGreaterThan(0)

  const excelGrand = wb.SheetNames.reduce((sheetSum, sheetName) => {
    const sheetRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1 })
    if (!sheetRows.length) return sheetSum
    const hs = (sheetRows[0] ?? []).map(normalizeHeader)
    const totalIdx = hs.indexOf('รวมเงิน')
    if (totalIdx < 0) return sheetSum
    return sheetSum + sheetRows.slice(1).reduce((sum, r) => {
      const row = r ?? []
      return sum + toNumber(row[totalIdx])
    }, 0)
  }, 0)
  const dbGrand = recordsJson.items.reduce((sum, r) => sum + Number(r.amount ?? 0), 0)
  expect(excelGrand).toBeGreaterThan(0)
  expect(dbGrand).toBeGreaterThan(0)

  const uploadRes = await page.request.post('/api/templates/upload', {
    multipart: {
      file: {
        name: 'BILL-TEST.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: readFileSync('d:/apartmentproject/BILL-TEST.docx')
      },
      code: `AUDIT-BILL-${Date.now()}`,
      name: 'Audit Billing'
    },
    headers: { 'x-csrf-token': csrf }
  })
  expect(uploadRes.ok()).toBeTruthy()
  const tpl = await uploadRes.json() as { id: string }

  const roomNumber = recordsJson.items[0]!.roomNumber
  const genRes = await page.request.post('/api/documents/generate', {
    form: {
      templateId: tpl.id,
      roomNumber,
      year: String(targetYear),
      month: String(targetMonth)
    },
    headers: { 'x-csrf-token': csrf }
  })
  expect(genRes.ok()).toBeTruthy()
  const doc = await genRes.json() as { id: string }

  const downloadRes = await page.request.get(`/api/documents/${doc.id}/download`, {
    headers: { 'x-csrf-token': csrf }
  })
  expect(downloadRes.ok()).toBeTruthy()

  const auditCsvRes = await page.request.get('/api/export/audit')
  expect(auditCsvRes.ok()).toBeTruthy()
  const auditCsv = await auditCsvRes.text()
  expect(/BILLING_IMPORT/.test(auditCsv) || /BILLING_IMPORT_SUCCESS/.test(auditCsv)).toBeTruthy()
  expect(/DOCUMENT_GENERATE/.test(auditCsv)).toBeTruthy()
})
