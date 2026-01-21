import type { RateLimiter, ConsumeResult } from "@/interface/rate-limit/types"

type Bucket = {
  timestamps: number[]
}

const store = new Map<string, Bucket>()

function now() {
  return Date.now()
}

function getBucket(key: string): Bucket {
  let b = store.get(key)
  if (!b) {
    b = { timestamps: [] }
    store.set(key, b)
  }
  return b
}

function prune(arr: number[], windowMs: number): number[] {
  const cutoff = now() - windowMs
  return arr.filter((t) => t >= cutoff)
}

export class InMemoryRateLimiter implements RateLimiter {
  consume(identityKey: string, routeKey: string, windowMs: number, limit: number): ConsumeResult {
    const key = `${identityKey}::${routeKey}`
    const b = getBucket(key)
    b.timestamps = prune(b.timestamps, windowMs)
    const remainingBefore = Math.max(0, limit - b.timestamps.length)
    if (remainingBefore <= 0) {
      const earliest = Math.min(...b.timestamps)
      const retryAfterMs = Math.max(0, earliest + windowMs - now())
      return { allowed: false, remaining: 0, retryAfterMs }
    }
    b.timestamps.push(now())
    const remaining = Math.max(0, limit - b.timestamps.length)
    return { allowed: true, remaining }
  }
}

