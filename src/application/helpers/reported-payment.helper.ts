import type { ReportedPaymentDTO } from "@/application/dto/reported-payment.dto"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"

function maskLineUserId(id: string | null | undefined): string | undefined {
  if (!id || id.length < 4) return undefined
  const tail = id.slice(-4)
  return `***${tail}`
}

export async function correlateReportedPayment(audit: {
  targetId: string | null
  tenantId: string | null
  timestamp: Date
  metadata?: Record<string, unknown> | null
}): Promise<ReportedPaymentDTO | null> {
  const invoiceId = audit.targetId || null
  if (!invoiceId) return null
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { tenant: true, room: true } })
  if (!inv) return null
  const lineUserId = typeof audit.metadata?.["lineUserId"] === "string" ? (audit.metadata?.["lineUserId"] as string) : inv.tenant?.lineUserId || undefined
  const dto: ReportedPaymentDTO = {
    invoiceId: inv.id,
    tenant: inv.tenant ? { id: inv.tenant.id, name: inv.tenant.name } : null,
    room: inv.room ? { id: inv.room.id, roomNumber: inv.room.roomNumber } : null,
    periodMonth: inv.periodMonth,
    amount: inv.totalAmount,
    invoiceStatus: inv.status as ReportedPaymentDTO["invoiceStatus"],
    reportedAt: audit.timestamp.toISOString(),
    pending: inv.status !== "PAID",
    resolved: inv.status === "PAID",
    lineUserIdMasked: maskLineUserId(lineUserId),
  }
  return dto
}

