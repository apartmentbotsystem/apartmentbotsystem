import { logger } from '@/lib/logging/file-logger'

const WINDOW_MS = 5 * 60 * 1000
const THRESHOLD = 10

let timestamps: number[] = []
let lastCriticalAt = 0

function prune(now: number): void {
  timestamps = timestamps.filter(t => now - t <= WINDOW_MS)
}

export function recordError(): void {
  const now = Date.now()
  prune(now)
  timestamps.push(now)
  prune(now)
  if (timestamps.length > THRESHOLD) {
    if (now - lastCriticalAt > WINDOW_MS) {
      lastCriticalAt = now
      void logger.error('CRITICAL: error threshold exceeded', { count: timestamps.length, windowMs: WINDOW_MS })
    }
  }
}

export function getErrorCount(): number {
  prune(Date.now())
  return timestamps.length
}

export function resetWindow(): void {
  timestamps = []
  lastCriticalAt = 0
}

