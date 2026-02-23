import { test, expect } from '@playwright/test'
import { loginAs, getCsrfToken } from './utils'
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

test('generate document twice and verify versions and file availability', async ({ page }) => {
  // Ensure a billing record exists for the current month (so room exists)
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const roomNumber = '3201'
  await loginAs(page, 'SUPER_ADMIN')
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([['Room', 'Amount'], [roomNumber, 1000]])
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  const csrf = await getCsrfToken(page)
  const billingRes = await page.request.post('/api/billing/import', {
    multipart: {
      file: { name: 'billing.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: xlsxBuf },
      year: String(y),
      month: String(m)
    },
    headers: { 'x-csrf-token': csrf }
  })
  expect(billingRes.ok()).toBeTruthy()
  // Switch to manager for template upload/generate
  await loginAs(page, 'SUPER_ADMIN')
  // Ensure template exists by uploading bundled BILL-TEST.docx
  const buf = readFileSync('d:/apartmentproject/BILL-TEST.docx')
  const uploadRes = await page.request.post('/api/templates/upload', {
    multipart: {
      file: { name: 'BILL-TEST.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: buf },
      code: 'E2E-BILL',
      name: 'E2E Billing'
    },
    headers: { 'x-csrf-token': csrf }
  })
  expect(uploadRes.ok()).toBeTruthy()
  const uploaded = await uploadRes.json() as { id: string }
  const templateId = uploaded.id
  // Compute previous max version for this room/month
  const prevMax = await page.evaluate(async ({ y, m, roomNumber }) => {
    const res = await fetch(`/api/documents?year=${y}&month=${m}&roomNumber=${roomNumber}`)
    const json = await res.json() as { items: Array<{ versionNo: number }> }
    const versions = json.items.map(i => i.versionNo)
    return versions.length ? Math.max(...versions) : 0
  }, { y, m, roomNumber })
  // First generate
  const gen1 = await page.evaluate(async ({ templateId, roomNumber, y, m }) => {
    const csrf = document.cookie.split('; ').find(s => s.startsWith('csrf='))?.split('=')[1] ?? ''
    const fd = new FormData()
    fd.append('templateId', templateId)
    fd.append('roomNumber', roomNumber)
    fd.append('year', String(y))
    fd.append('month', String(m))
    const res = await fetch('/api/documents/generate', { method: 'POST', body: fd, headers: { 'x-csrf-token': csrf } })
    return await res.json()
  }, { templateId, roomNumber, y, m })
  expect(gen1?.versionNo ?? 0).toBe(prevMax + 1)
  // Second generate
  const gen2 = await page.evaluate(async ({ templateId, roomNumber, y, m }) => {
    const csrf = document.cookie.split('; ').find(s => s.startsWith('csrf='))?.split('=')[1] ?? ''
    const fd = new FormData()
    fd.append('templateId', templateId)
    fd.append('roomNumber', roomNumber)
    fd.append('year', String(y))
    fd.append('month', String(m))
    const res = await fetch('/api/documents/generate', { method: 'POST', body: fd, headers: { 'x-csrf-token': csrf } })
    return await res.json()
  }, { templateId, roomNumber, y, m })
  expect(gen2?.versionNo ?? 0).toBe(prevMax + 2)
  // List versions and verify both exist
  const list = await page.evaluate(async ({ y, m, roomNumber }) => {
    const res = await fetch(`/api/documents?year=${y}&month=${m}&roomNumber=${roomNumber}`)
    return await res.json()
  }, { y, m, roomNumber }) as { items: Array<{ id: string; versionNo: number }> }
  const v1 = list.items.find(v => v.versionNo === 1)
  const v2 = list.items.find(v => v.versionNo === 2)
  expect(v1).toBeTruthy()
  expect(v2).toBeTruthy()
  // Verify file exists for both versions (download returns 200)
  const ok1 = await page.evaluate(async (id) => (await fetch(`/api/documents/${id}/download`)).ok, v1!.id)
  const ok2 = await page.evaluate(async (id) => (await fetch(`/api/documents/${id}/download`)).ok, v2!.id)
  expect(ok1).toBe(true)
  expect(ok2).toBe(true)
})
