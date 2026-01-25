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

export async function ingestLineMessage(payload: unknown): Promise<string | null> {
  const externalThreadId = getExternalThreadId(payload)
  if (!externalThreadId) return null
  const title = getTitle(payload)
  let ticketId: string | null = null
  await domainTransaction(async () => {
    const existingOpen = await prisma.ticket.findFirst({
      where: { externalThreadId, status: "OPEN" },
      select: { id: true },
    })
    if (existingOpen) {
      ticketId = existingOpen.id
      return
    }
    const created = await prisma.ticket.create({
      data: {
        source: "LINE",
        externalThreadId,
        title,
        status: "OPEN",
      },
      select: { id: true, source: true, externalThreadId: true, title: true, status: true, createdAt: true },
    })
    ticketId = created.id
    await emitAuditEvent({
      actorType: "SYSTEM",
      action: "TICKET_CREATED",
      targetType: "TICKET",
      targetId: created.id,
      severity: "INFO",
      before: null,
      after: {
        ticketId: created.id,
        source: created.source,
        externalThreadId: created.externalThreadId,
        title: created.title,
        status: created.status,
        createdAt: created.createdAt.toISOString(),
      },
    })
  })
  return ticketId
}
