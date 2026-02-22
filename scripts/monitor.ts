import { setTimeout as delay } from 'node:timers/promises'

function getUrl(): string {
  const env = process.env['HEALTH_URL']
  if (env && env.trim()) return env
  return 'http://localhost:3000/api/health'
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), ms)
  try {
    return await fetch(url, { signal: ac.signal })
  } finally {
    clearTimeout(t)
  }
}

async function main(): Promise<void> {
  const url = getUrl()
  try {
    const res = await fetchWithTimeout(url, 5000)
    if (!res.ok) {
      console.error(`Health check HTTP ${res.status}`)
      process.exit(1)
      return
    }
    const body: unknown = await res.json()
    if (
      typeof body === 'object' &&
      body !== null &&
      (body as Record<string, unknown>)['status'] === 'ok' &&
      (body as Record<string, unknown>)['db'] === 'connected'
    ) {
      process.exit(0)
      return
    }
    console.error('Health check invalid payload')
    process.exit(1)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`Health check failed: ${msg}`)
    process.exit(1)
  }
}

main()

