export async function withTimeout<T>(ms: number, fn: () => Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | null = null
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), ms)
  })
  try {
    const res = await Promise.race([fn(), timeout])
    if (timer) clearTimeout(timer)
    return res as T
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function clampLimitFromRequest(req: Request, def = 100, max = 1000): number {
  try {
    const url = new URL(req.url)
    const raw = url.searchParams.get('limit')
    const n = raw ? Number(raw) : def
    if (!Number.isFinite(n) || n <= 0) return def
    return Math.min(Math.floor(n), max)
  } catch {
    return def
  }
}
