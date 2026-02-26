export function toDisplayZoned(input: Date | string): string {
  const d = typeof input === 'string' ? parseInput(input) : input
  return new Date(d.getTime()).toISOString()
}

export function parseDateYmdToUtc(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return new Date(0)
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const day = Number(m[3])
  return new Date(Date.UTC(y, mo, day))
}

export function getSystemTimezoneFromEnv(): string {
  const tz = process.env['TZ'] || process.env['SYSTEM_TZ'] || ''
  return tz || 'Asia/Bangkok'
}

function parseInput(s: string): Date {
  const d = new Date(s)
  if (isNaN(d.getTime())) return new Date(0)
  return d
}
