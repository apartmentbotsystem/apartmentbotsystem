import { DomainError } from '@/domain/errors'
import type { Role } from './types'

export function requireRole(userRole: Role, allowed: Role[]): void {
  if (!allowed.includes(userRole)) {
    throw new DomainError('FORBIDDEN', 'Insufficient permissions', 403)
  }
}
