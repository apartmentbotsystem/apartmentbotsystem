export function formatYm(input: Date | string | number, monthMaybe?: number): string {
  if (typeof input === 'number' && typeof monthMaybe === 'number') {
    const year = input
    const month = monthMaybe
    const mm = month < 10 ? `0${month}` : String(month)
    return `${year}-${mm}`
  }
  const d = typeof input === 'string' ? parseInput(input) : (input as Date)
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth() + 1
  const mm = month < 10 ? `0${month}` : String(month)
  return `${year}-${mm}`
}

export function getConsumptionYm(dateOrYear?: Date | number, monthMaybe?: number): string {
  if (typeof dateOrYear === 'number' && typeof monthMaybe === 'number') {
    return formatYm(dateOrYear, monthMaybe)
  }
  const d = (dateOrYear instanceof Date) ? dateOrYear : new Date()
  return formatYm(d)
}

function parseInput(s: string): Date {
  if (/^\d{4}-\d{2}$/.test(s)) {
    return new Date(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, 1))
  }
  const d = new Date(s)
  if (isNaN(d.getTime())) return new Date(0)
  return d
}
