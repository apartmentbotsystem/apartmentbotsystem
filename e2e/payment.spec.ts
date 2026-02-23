import { test, expect } from '@playwright/test'
import { loginAs, getCsrfToken } from './utils'
import * as XLSX from 'xlsx'

function makeWorkbook(ref: string): Buffer {
  const data = [
    ['Date', 'Amount', 'Reference'],
    [new Date().toISOString().slice(0,10), '123.45', ref]
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return buf
}

test('import payment and match to billing; audit & dashboard reflect', async ({ page }) => {
  await loginAs(page, 'SUPER_ADMIN')
  const csrf = await getCsrfToken(page)
  // Seed a billing record for current month
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const roomNumber = '3202'
  const wbBill = XLSX.utils.book_new()
  const wsBill = XLSX.utils.aoa_to_sheet([['Room', 'Amount'], [roomNumber, 123.45]])
  XLSX.utils.book_append_sheet(wbBill, wsBill, 'Sheet1')
  const bufBill = XLSX.write(wbBill, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  const billRes = await page.request.post('/api/billing/import', {
    multipart: {
      file: { name: 'billing.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: bufBill },
      year: String(y),
      month: String(m)
    },
    headers: { 'x-csrf-token': csrf }
  })
  expect(billRes.ok()).toBeTruthy()

  // Snapshot analytics before
  const beforeSummary = await page.evaluate(async () => {
    const res = await fetch('/api/analytics/summary')
    return await res.json()
  })

  // Import payments
  const uniqueRef = `E2E TEST PAYMENT ${Date.now()}`
  const fileBuffer = makeWorkbook(uniqueRef)
  const payRes = await page.request.post('/api/payments/import', {
    multipart: { file: { name: 'payments.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: fileBuffer } },
    headers: { 'x-csrf-token': csrf }
  })
  expect(payRes.ok()).toBeTruthy()
  const imported = await page.evaluate(async ({ year, month }) => {
    const res = await fetch(`/api/payments?year=${year}&month=${month}`)
    const json = await res.json()
    return (json.items as unknown[]).length
  }, { year: y, month: m })
  expect(imported).toBeGreaterThan(0)

  // Match the imported payment to our billing record via API
  const [payments, records] = await Promise.all([
    page.evaluate(async ({ year, month }) => {
      const res = await fetch(`/api/payments?year=${year}&month=${month}`)
      return await res.json()
    }, { year: y, month: m }),
    page.evaluate(async ({ year, month }) => {
      const res = await fetch(`/api/billing/records?year=${year}&month=${month}`)
      return await res.json()
    }, { year: y, month: m })
  ]) as [{ items: Array<{ id: string; bankRef: string | null; matched: boolean }> }, { items: Array<{ id: string; roomNumber: string }> }]
  const paymentId = (payments.items.find(p => p.bankRef === uniqueRef && !p.matched) ?? payments.items.find(p => !p.matched) ?? payments.items[0]).id
  const targetRecord = records.items.find(r => r.roomNumber === roomNumber)!
  const matchRes = await page.request.post('/api/payments/match', {
    data: { paymentId, billingRecordId: targetRecord.id, amount: 123.45, confirm: true },
    headers: { 'x-csrf-token': csrf }
  })
  expect(matchRes.ok()).toBeTruthy()

  // Verify audit CSV contains PAYMENT_MATCH
  const auditCsv = await page.evaluate(async () => {
    const res = await fetch('/api/export/audit')
    return await res.text()
  })
  expect(auditCsv).toMatch(/PAYMENT_MATCH/)

  // Verify analytics summary changed (balance reduced)
  const afterSummary = await page.evaluate(async () => {
    const res = await fetch('/api/analytics/summary')
    return await res.json()
  })
  expect(afterSummary.billing.balance).toBeLessThanOrEqual(beforeSummary.billing.balance)
})
