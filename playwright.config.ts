import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3001',
    headless: true,
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run build && next start -p 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      AUTH_SECRET: 'e2e-secret',
      E2E_ALLOW_ANY_USER: 'true',
      NODE_ENV: 'production'
    }
  }
})
