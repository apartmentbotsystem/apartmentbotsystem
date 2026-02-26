export function isDecimal(x: unknown): x is { toNumber: () => number } {
  return typeof x === 'object' && x !== null && 'toNumber' in (x as Record<string, unknown>) && typeof (x as { toNumber: unknown }).toNumber === 'function'
}

export function toNumberSafe(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return Number(v)
  if (isDecimal(v)) return v.toNumber()
  return Number(v as unknown)
}

