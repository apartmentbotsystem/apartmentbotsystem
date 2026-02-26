import { defineConfig } from '@playwright/test'

const useExisting = process.env.USE_EXISTING_SERVER === 'true'
const baseURL = useExisting ? 'http://localhost:3000' : 'http://localhost:3001'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 1,
  use: {
    baseURL,
    headless: true,
    trace: 'retain-on-failure'
  },
  webServer: useExisting
    ? undefined
    : {
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
