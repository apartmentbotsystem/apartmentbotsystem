import { logInfo } from '@/infrastructure/logger'

type AuditInput = {
  entityType: string
  entityId: string
  action: string
  oldValue: unknown
  newValue: unknown
  actor: unknown
}

export async function logAudit(input: AuditInput): Promise<void> {
  logInfo('audit.log', input as Record<string, unknown>)
}
