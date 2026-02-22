import { DomainError } from '@/domain/errors'
import type { AuthUser } from './types'

export function assertAuthenticated(user: AuthUser | null): asserts user is AuthUser {
  if (!user) {
    throw new DomainError('UNAUTHORIZED', 'Authentication required', 401)
  }
}
