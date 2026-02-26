type Key = string

const WINDOW_MS = 60_000
const LIMIT = 100
const store = new Map<Key, { count: number; windowStart: number; windowMs: number; limit: number }>()

export function checkRateLimit(ip: string, route: string): { allowed: boolean; remaining: number } {
  const key = `${ip}:${route}`
  const now = Date.now()
  const rec = store.get(key)
  if (!rec || now - rec.windowStart >= (rec?.windowMs ?? WINDOW_MS)) {
    store.set(key, { count: 1, windowStart: now, windowMs: WINDOW_MS, limit: LIMIT })
    return { allowed: true, remaining: LIMIT - 1 }
  }
  if (rec.count >= (rec.limit ?? LIMIT)) {
    return { allowed: false, remaining: 0 }
  }
  rec.count++
  return { allowed: true, remaining: Math.max(0, (rec.limit ?? LIMIT) - rec.count) }
}

export function getClientIp(req: Request): string {
  // Next.js on Node: use standard proxy headers if available
  const h = req.headers
  const forwarded = h.get('x-forwarded-for') ?? ''
  const ip = forwarded.split(',')[0]?.trim()
  return ip || (h.get('x-real-ip') ?? 'unknown')
}

export function checkRateLimitCustom(key: string, windowMs: number, limit: number): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const rec = store.get(key)
  if (!rec || now - rec.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now, windowMs, limit })
    return { allowed: true, remaining: limit - 1 }
  }
  if (rec.count >= limit) {
    return { allowed: false, remaining: 0 }
  }
  rec.count++
  rec.windowMs = windowMs
  rec.limit = limit
  return { allowed: true, remaining: Math.max(0, limit - rec.count) }
}
