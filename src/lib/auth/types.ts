export type Role =
  | 'ADMIN'
  | 'MANAGER'
  | 'ACCOUNTANT'
  | 'STAFF'
  | 'SUPER_ADMIN'
  | 'FINANCE'
  | 'VIEWER'

export interface AuthUser {
  id: string
  role: Role
}
