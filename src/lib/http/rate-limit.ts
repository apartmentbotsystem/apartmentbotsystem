type Key = string

const WINDOW_MS = 60_000
const LIMIT = 100
const store = new Map<Key, { count: number; windowStart: number }>()

export function checkRateLimit(ip: string, route: string): { allowed: boolean; remaining: number } {
  const key = `${ip}:${route}`
  const now = Date.now()
  const rec = store.get(key)
  if (!rec || now - rec.windowStart >= WINDOW_MS) {
    store.set(key, { count: 1, windowStart: now })
    return { allowed: true, remaining: LIMIT - 1 }
  }
  if (rec.count >= LIMIT) {
    return { allowed: false, remaining: 0 }
  }
  rec.count++
  return { allowed: true, remaining: Math.max(0, LIMIT - rec.count) }
}

export function getClientIp(req: Request): string {
  // Next.js on Node: use standard proxy headers if available
  const h = req.headers
  const forwarded = h.get('x-forwarded-for') ?? ''
  const ip = forwarded.split(',')[0]?.trim()
  return ip || (h.get('x-real-ip') ?? 'unknown')
}

