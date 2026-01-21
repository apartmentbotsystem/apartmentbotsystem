export function getPolicy(method: string, _path: string): { windowMs: number; limit: number } {
  const m = method.toUpperCase()
  const heavy = _path.includes("/import") || _path.includes("/export")
  if (m === "GET") return { windowMs: 60_000, limit: heavy ? 60 : 120 }
  return { windowMs: 60_000, limit: heavy ? 30 : 60 }
}
