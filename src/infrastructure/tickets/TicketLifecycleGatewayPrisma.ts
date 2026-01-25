import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { domainTransaction } from "@/infrastructure/db/domainTransaction"
import type { TicketLifecycleGateway, TicketEntity, TicketStatus } from "@/domain/tickets/ticketLifecycle.service"

export class TicketLifecycleGatewayPrisma implements TicketLifecycleGateway {
  async getById(id: string): Promise<TicketEntity | null> {
    const t = await prisma.ticket.findUnique({ where: { id } })
    if (!t) return null
    return { id: t.id, status: t.status as TicketStatus, closedAt: t.closedAt ?? null }
  }

  async createOpen(data: { id?: string }): Promise<TicketEntity> {
    return domainTransaction(async () => {
      const created = await prisma.ticket.create({
        data: {
          id: data.id,
          source: "LINE",
          externalThreadId: "unknown",
          title: "New Ticket",
          status: "OPEN",
        },
      })
      return { id: created.id, status: created.status as TicketStatus, closedAt: created.closedAt ?? null }
    })
  }

  async setStatus(id: string, status: TicketStatus, closedAt?: Date | null): Promise<TicketEntity> {
    return domainTransaction(async () => {
      const updated = await prisma.ticket.update({
        where: { id },
        data: { status, closedAt: closedAt ?? undefined },
      })
      return { id: updated.id, status: updated.status as TicketStatus, closedAt: updated.closedAt ?? null }
    })
  }
}
