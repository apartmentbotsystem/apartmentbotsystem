import { test, expect } from '@playwright/test'
import { loginAs, selectTopbarContext } from './utils'

test('dashboard shows 4 metric cards and updates on month change', async ({ page }) => {
  await loginAs(page, 'FINANCE')
  await page.goto('/dashboard')
  await expect(page.getByText('อัตราการเข้าอยู่')).toBeVisible()
  await expect(page.getByText('รายรับเดือนนี้')).toBeVisible()
  await expect(page.getByText('ค้างชำระ')).toBeVisible()
  await expect(page.getByText('ทิกเก็ตที่เปิดอยู่')).toBeVisible()

  // Capture current month text
  const beforeSelVal = await page.evaluate(() => {
    const sel = document.querySelector('header select[name="month"]') as HTMLSelectElement | null
    return sel ? Number(sel.value) : (new Date().getMonth() + 1)
  })

  // Change month based on current selected value in topbar
  const newMonth = beforeSelVal === 12 ? 1 : 12
  await selectTopbarContext(page, { month: newMonth })

  // Assert topbar month select reflects new value (source of truth for context) and cookie updated
  const selVal = await page.evaluate(() => {
    const sel = document.querySelector('header select[name="month"]') as HTMLSelectElement | null
    return sel ? Number(sel.value) : 0
  })
  expect(selVal).toBe(newMonth)
  const cookies = await page.context().cookies('http://localhost:3001/')
  const monthCookie = cookies.find(c => c.name === 'activeMonth')
  expect(monthCookie?.value).toBe(String(newMonth))
})
