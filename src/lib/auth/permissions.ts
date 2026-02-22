export const PERMISSIONS = {
  UNIT_READ: 'unit.read',
  UNIT_WRITE: 'unit.write',
  TENANT_MANAGE: 'tenant.manage',
  PAYMENT_CREATE: 'payment.create'
} as const

export type PermissionCode = typeof PERMISSIONS[keyof typeof PERMISSIONS]

