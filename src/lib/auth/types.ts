export type CanonicalRole = 'OWNER' | 'ADMIN' | 'STAFF'

export type LegacyRole =
  | 'MANAGER'
  | 'ACCOUNTANT'
  | 'SUPER_ADMIN'
  | 'FINANCE'
  | 'VIEWER'

export type Role = CanonicalRole | LegacyRole

export interface AuthUser {
  id: string
  role: CanonicalRole
}
