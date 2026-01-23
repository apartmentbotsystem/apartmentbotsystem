import { prisma } from "@/infrastructure/db/prisma/prismaClient"
type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | { [x: string]: JsonValue } | JsonValue[]

export type AuditEventInput = {
  actorType: "ADMIN" | "STAFF" | "SYSTEM"
  actorId?: string | null
  action: string
  targetType: "TENANT" | "INVOICE" | "PAYMENT" | "AUTH"
  targetId?: string | null
  severity: "INFO" | "WARN" | "CRITICAL"
  metadata?: JsonValue | null
}

export async function emitAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        severity: input.severity,
        metadata: input.metadata ?? undefined,
      },
    })
  } catch (err) {
    // Non-blocking: log error but never throw
    console.error("[audit] emit failed", err)
  }
}
