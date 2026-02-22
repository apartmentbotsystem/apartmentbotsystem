import crypto from 'node:crypto'
import { prisma } from '@/lib/db'

const WINDOW_MS = 10 * 60 * 1000

export function sha256Hex(input: string | Uint8Array): string {
  const h = crypto.createHash('sha256')
  h.update(input)
  return h.digest('hex')
}

export async function ensureIdempotent<T>(route: string, key: string | null, payloadHash: string, handler: () => Promise<T>): Promise<{ reused: boolean; result: T }> {
  if (!key) {
    const result = await handler()
    return { reused: false, result }
  }
  const cutoff = new Date(Date.now() - WINDOW_MS)
  const existing = await prisma.idempotencyRecord.findFirst({
    where: { key, route, createdAt: { gt: cutoff } }
  })
  if (existing && existing.hash === payloadHash) {
    return { reused: true, result: existing.response as T }
  }
  const result = await handler()
  try {
    await prisma.idempotencyRecord.upsert({
      where: { key_route: { key, route } },
      update: { hash: payloadHash, response: JSON.parse(JSON.stringify(result)), createdAt: new Date() },
      create: { key, route, hash: payloadHash, response: JSON.parse(JSON.stringify(result)) }
    })
  } catch {
    // best-effort; if race happens, subsequent call will reuse
  }
  return { reused: false, result }
}
