import { DomainError } from '@/domain/errors'

export function toHttpErrorPayload(err: unknown): { status: number; body: { error: string; code?: string } } {
  if (err instanceof DomainError) {
    return { status: err.status ?? 400, body: { error: err.message, code: err.code } }
  }
  if (err instanceof Error) {
    return { status: 500, body: { error: err.message } }
  }
  return { status: 500, body: { error: 'internal_error' } }
}
