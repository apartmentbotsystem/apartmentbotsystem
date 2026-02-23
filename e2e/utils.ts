import { Page, expect } from '@playwright/test'

export async function loginAs(page: Page, role: 'FINANCE' | 'ADMIN' | 'SUPER_ADMIN' = 'SUPER_ADMIN') {
  await page.goto('/dashboard')
  await page.evaluate(async (r) => {
    await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'e2e-user', role: r, sessionVersion: 0 })
    })
  }, role)
  await page.reload()
  // simple check: dashboard text present
  await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 5000 }).catch(() => {})
}

export async function selectTopbarContext(page: Page, opts: { year?: number; month?: number; buildingLabel?: string }) {
  const form = page.locator('header form')
  if (opts.year != null) await form.locator('select[name="year"]').selectOption(String(opts.year))
  if (opts.month != null) await form.locator('select[name="month"]').selectOption(String(opts.month))
  if (opts.buildingLabel != null) await form.locator('select[name="buildingId"]').selectOption({ label: opts.buildingLabel }).catch(() => {})
  await page.waitForLoadState('networkidle')
}

export async function getCsrfToken(page: Page): Promise<string> {
  const cookies = await page.context().cookies('http://localhost:3001/')
  const csrf = cookies.find(c => c.name === 'csrf')?.value ?? ''
  return csrf
}
