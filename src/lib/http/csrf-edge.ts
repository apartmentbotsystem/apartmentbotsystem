// Edge-safe CSRF verification (no Node imports)
export function verifyCsrfEdge(req: Request): boolean {
  const header = req.headers.get('x-csrf-token')
  if (!header) return false
  const cookie = req.headers.get('cookie') ?? ''
  const m = cookie.match(/(?:^|;\s*)csrf=([^;]+)/)
  if (!m) return false
  try {
    const v = decodeURIComponent(m[1] ?? '')
    return v === header
  } catch {
    return false
  }
}

