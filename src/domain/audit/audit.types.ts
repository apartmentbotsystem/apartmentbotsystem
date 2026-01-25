export const AUDIT_TARGET_TYPES = [
  "TENANT",
  "INVOICE",
  "PAYMENT",
  "AUTH",
  "CONTRACT",
  "TICKET",
  "ROOM",
] as const

export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number]
