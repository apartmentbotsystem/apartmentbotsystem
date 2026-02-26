import type { AuthUser } from '@/lib/auth/types'
import { requireRole } from '@/lib/auth/roles'

export function assertRole(user: AuthUser, _permission: string): void {
  requireRole(user.role, ['OWNER', 'ADMIN', 'STAFF'])
}
