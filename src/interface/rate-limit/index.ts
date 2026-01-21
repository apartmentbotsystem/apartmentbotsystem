import { InMemoryRateLimiter } from "@/interface/rate-limit/inmemory"
import type { RateLimiter } from "@/interface/rate-limit/types"

let instance: RateLimiter | null = null

export function getRateLimiter(): RateLimiter {
  if (!instance) {
    instance = new InMemoryRateLimiter()
  }
  return instance
}

