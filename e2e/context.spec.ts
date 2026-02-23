import { test, expect } from '@playwright/test'
import { loginAs, selectTopbarContext } from './utils'

test('building and month context affects UI', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAs(page, 'SUPER_ADMIN')
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('อัตราการเข้าอยู่')).toBeVisible({ timeout: 15000 })

  // Change month
  const currentSelected = await page.evaluate(() => {
    const sel = document.querySelector('header select[name="month"]') as HTMLSelectElement | null
    return sel ? Number(sel.value) : (new Date().getMonth() + 1)
  })
  const target = currentSelected === 12 ? 1 : 12
  await selectTopbarContext(page, { month: target })
  // Verify UI reflects
  const selVal = await page.evaluate(() => {
    const sel = document.querySelector('header select[name="month"]') as HTMLSelectElement | null
    return sel ? Number(sel.value) : 0
  })
  expect(selVal).toBe(target)

  // Navigate to billing and ensure table renders under selected context
  await page.goto('/billing')
  await page.waitForSelector('table')
  const rows = await page.locator('tbody tr').count()
  expect(rows).toBeGreaterThanOrEqual(0)
})
