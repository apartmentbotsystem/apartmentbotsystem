export type ConsumeResult = {
  allowed: boolean
  remaining: number
  retryAfterMs?: number
}

export interface RateLimiter {
  consume(identityKey: string, routeKey: string, windowMs: number, limit: number): ConsumeResult
}

