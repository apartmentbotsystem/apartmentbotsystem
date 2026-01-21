type Bucket = {
  requests: number[]
  invalids: number[]
}

const store = new Map<string, Bucket>()

const REQUEST_WINDOW_MS = 5000
const REQUEST_BURST_THRESHOLD = 20

const INVALID_WINDOW_MS = 60000
const INVALID_THRESHOLD = 10

function now() {
  return Date.now()
}

function getBucket(ip: string): Bucket {
  let b = store.get(ip)
  if (!b) {
    b = { requests: [], invalids: [] }
    store.set(ip, b)
  }
  return b
}

function prune(arr: number[], windowMs: number): number[] {
  const cutoff = now() - windowMs
  return arr.filter((t) => t >= cutoff)
}

export function recordRequest(ip: string): { countInWindow: number; isBurst: boolean } {
  const b = getBucket(ip)
  b.requests = prune(b.requests, REQUEST_WINDOW_MS)
  b.requests.push(now())
  const count = b.requests.length
  return { countInWindow: count, isBurst: count > REQUEST_BURST_THRESHOLD }
}

export function recordInvalidPayload(ip: string): { countInWindow: number; isBurst: boolean } {
  const b = getBucket(ip)
  b.invalids = prune(b.invalids, INVALID_WINDOW_MS)
  b.invalids.push(now())
  const count = b.invalids.length
  return { countInWindow: count, isBurst: count > INVALID_THRESHOLD }
}

export function isBodyTooLarge(contentLengthHeader: string | null, thresholdBytes = 1_000_000): { tooLarge: boolean; size?: number } {
  if (!contentLengthHeader) return { tooLarge: false }
  const size = Number(contentLengthHeader)
  if (!Number.isFinite(size)) return { tooLarge: false }
  return { tooLarge: size > thresholdBytes, size }
}

