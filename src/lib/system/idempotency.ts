import { ConflictError } from '@/domain/errors'

const WINDOW_MS = 5_000
const lastExec = new Map<string, number>()

export function guardIdempotent(key: string): void {
  const now = Date.now()
  const prev = lastExec.get(key)
  if (prev && now - prev < WINDOW_MS) {
    throw new ConflictError('DUPLICATE_OPERATION')
  }
  lastExec.set(key, now)
}

