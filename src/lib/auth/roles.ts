import { DomainError } from '@/domain/errors'
import type { Role } from './types'
import { mapRoleToCanonical } from '@/lib/auth/session'

export function requireRole(userRole: Role, allowed: Role[]): void {
  const effective = mapRoleToCanonical(userRole)
  const allowedCanonical = allowed.map((role) => mapRoleToCanonical(role))
  if (!allowedCanonical.includes(effective)) {
    throw new DomainError('FORBIDDEN', 'Insufficient permissions', 403)
  }
}
