import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { domainTransaction } from "@/infrastructure/db/domainTransaction"

export class TicketOutboxGatewayPrisma {
  async create(input: {
    ticketId: string
    channel: "LINE"
    payload: Record<string, unknown>
    status: "PENDING"
    createdAt: Date
  }): Promise<{
    id: string
    ticketId: string
    channel: "LINE"
    payload: Record<string, unknown>
    status: "PENDING" | "SENT" | "FAILED"
    createdAt: Date
    sentAt: Date | null
  }> {
    return domainTransaction(async () => {
      const created = await prisma.ticketOutbox.create({
        data: {
          ticketId: input.ticketId,
          channel: input.channel,
          payload: input.payload,
          status: input.status,
          createdAt: input.createdAt,
        },
      })
      return {
        id: created.id,
        ticketId: created.ticketId,
        channel: created.channel as "LINE",
        payload: (created.payload ?? {}) as Record<string, unknown>,
        status: created.status as "PENDING" | "SENT" | "FAILED",
        createdAt: created.createdAt,
        sentAt: created.sentAt ?? null,
      }
    })
  }

  async findById(id: string): Promise<{ id: string; ticketId: string; status: "PENDING" | "SENT" | "FAILED"; payload: Record<string, unknown> } | null> {
    const row = await prisma.ticketOutbox.findUnique({ where: { id } })
    if (!row) return null
    return {
      id: row.id,
      ticketId: row.ticketId,
      status: row.status as "PENDING" | "SENT" | "FAILED",
      payload: (row.payload ?? {}) as Record<string, unknown>,
    }
  }

  async markSent(id: string, sentAt: Date): Promise<void> {
    await domainTransaction(async () => {
      await prisma.ticketOutbox.update({
        where: { id },
        data: { status: "SENT", sentAt, errorMessage: null },
      })
    })
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    await domainTransaction(async () => {
      const row = await prisma.ticketOutbox.findUnique({ where: { id } })
      if (!row) return
      const current = row.retryCount ?? 0
      const next = current + 1
      if (next >= 3) {
        await prisma.ticketOutbox.update({
          where: { id },
          data: { status: "FAILED", errorMessage, retryCount: next, nextRetryAt: null },
        })
        return
      }
      const now = new Date()
      const backoffMinutes = next === 1 ? 1 : next === 2 ? 5 : 30
      const nextRetryAt = new Date(now.getTime() + backoffMinutes * 60 * 1000)
      await prisma.ticketOutbox.update({
        where: { id },
        data: { errorMessage, retryCount: next, nextRetryAt },
      })
    })
  }

  async getTicketExternalThreadId(ticketId: string): Promise<string> {
    const t = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { externalThreadId: true } })
    return t?.externalThreadId ?? ""
  }

  async findEligibleBatch(limit: number): Promise<Array<{ id: string }>> {
    const rows = await prisma.ticketOutbox.findMany({
      where: {
        status: "PENDING",
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
      },
      take: limit,
      orderBy: { createdAt: "asc" },
      select: { id: true },
    })
    return rows
  }
}
