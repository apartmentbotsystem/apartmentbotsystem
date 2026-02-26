import { DomainError } from '@/domain/errors'
import type { Prisma } from '@prisma/client'
import { recordError } from '@/lib/system/error-monitor'

export type ApiErrorPayload = {
  status: number
  body: {
    error: string
    message: string
  }
}

export function handleApiError(error: unknown): ApiErrorPayload {
  if (error instanceof Error && error.message === 'REQUEST_TIMEOUT') {
    return { status: 504, body: { error: 'TIMEOUT', message: 'Request timed out' } }
  }
  if (error instanceof DomainError) {
    const status = typeof error.status === 'number' ? error.status : 400
    const payload = { status, body: { error: error.code, message: error.message } }
    if (status >= 500) recordError()
    return payload
  }
  if (isPrismaKnownRequestError(error)) {
    const code = error.code
    if (code === 'P2002') {
      return { status: 409, body: { error: 'CONFLICT', message: 'Unique constraint violation' } }
    }
    if (code === 'P2025') {
      return { status: 404, body: { error: 'NOT_FOUND', message: 'Record not found' } }
    }
    const payload = { status: 500, body: { error: 'PRISMA_ERROR', message: code } }
    recordError()
    return payload
  }
  const msg = error instanceof Error ? error.message : 'Internal Server Error'
  recordError()
  return { status: 500, body: { error: 'INTERNAL', message: msg } }
}

function isPrismaKnownRequestError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  if (!err || typeof err !== 'object') return false
  if (!('code' in err) || !('clientVersion' in err)) return false
  const rec = err as Record<string, unknown>
  return typeof rec.code === 'string' && rec.clientVersion !== undefined
}
