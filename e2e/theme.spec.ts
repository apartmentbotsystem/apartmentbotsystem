import { test, expect } from '@playwright/test'
import { loginAs } from './utils'

test('theme persists after toggle and reload', async ({ page }) => {
  await loginAs(page, 'SUPER_ADMIN')
  const logs: string[] = []
  page.on('console', (m) => logs.push(m.text()))
  await page.goto('/dashboard')
  await page.click('button[aria-label="สลับธีม"]')
  await page.reload()
  // Assert html.dark exists
  await expect(page.locator('html.dark')).toHaveCount(1)
  // Assert localStorage theme=dark
  const theme = await page.evaluate(() => window.localStorage.getItem('erp-theme'))
  expect(theme).toBe('dark')
  // Assert no hydration error
  const hasHydrationError = logs.some(t => /hydration/i.test(t))
  expect(hasHydrationError).toBe(false)
})
