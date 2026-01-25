import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { domainTransaction } from "@/infrastructure/db/domainTransaction"
import { emitAuditEvent } from "@/infrastructure/audit/audit.service"

function getExternalThreadId(payload: unknown): string | null {
  const p = payload as { source?: { userId?: string; groupId?: string; roomId?: string } }
  const src = p?.source
  return src?.userId || src?.groupId || src?.roomId || null
}

function getTitle(payload: unknown): string {
  const p = payload as { message?: { text?: string } }
  const text = String(p?.message?.text || "").trim()
  const t = text || "ข้อความใหม่"
  return t.length > 255 ? t.slice(0, 255) : t
}

export async function ingestLineMessage(payload: unknown): Promise<void> {
  const externalThreadId = getExternalThreadId(payload)
  if (!externalThreadId) return
  const title = getTitle(payload)
  await domainTransaction(async () => {
    const exists = await prisma.ticket.findFirst({
      where: { externalThreadId, title, source: "LINE" },
      select: { id: true },
    })
    if (exists) return
    const ticket = await prisma.ticket.create({
      data: {
        source: "LINE",
        externalThreadId,
        title,
        status: "OPEN",
      },
      select: { id: true },
    })
    await emitAuditEvent({
      actorType: "SYSTEM",
      action: "TICKET_CREATED",
      targetType: "TICKET",
      targetId: ticket.id,
      severity: "INFO",
      before: null,
      after: { ticketId: ticket.id, source: "LINE", externalThreadId, status: "OPEN" },
    })
  })
}
