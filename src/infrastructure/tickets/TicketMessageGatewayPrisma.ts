import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { domainTransaction } from "@/infrastructure/db/domainTransaction"

export class TicketMessageGatewayPrisma {
  async create(input: {
    ticketId: string
    direction: "INBOUND" | "OUTBOUND"
    channel: "LINE"
    messageText: string
    createdAt: Date
  }): Promise<{
    id: string
    ticketId: string
    direction: "INBOUND" | "OUTBOUND"
    channel: "LINE"
    messageText: string
    createdAt: Date
  }> {
    return domainTransaction(async () => {
      const created = await prisma.ticketMessage.create({
        data: {
          ticketId: input.ticketId,
          direction: input.direction,
          channel: input.channel,
          messageText: input.messageText,
          createdAt: input.createdAt,
        },
      })
      return {
        id: created.id,
        ticketId: created.ticketId,
        direction: created.direction as "INBOUND" | "OUTBOUND",
        channel: created.channel as "LINE",
        messageText: created.messageText,
        createdAt: created.createdAt,
      }
    })
  }
}
