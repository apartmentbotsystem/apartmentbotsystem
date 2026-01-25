import { prisma } from "@/infrastructure/db/prisma/prismaClient"

export async function getTicketMessages(ticketId: string): Promise<
  Array<{
    id: string
    ticketId: string
    direction: "INBOUND" | "OUTBOUND"
    channel: "LINE"
    messageText: string
    createdAt: Date
  }>
> {
  const rows = await prisma.ticketMessage.findMany({
    where: { ticketId },
    orderBy: { createdAt: "asc" },
    take: 2000,
  })
  type Row = Awaited<ReturnType<typeof prisma.ticketMessage.findMany>>[number]
  return rows.map((r: Row) => ({
    id: r.id,
    ticketId: r.ticketId,
    direction: r.direction as "INBOUND" | "OUTBOUND",
    channel: r.channel as "LINE",
    messageText: r.messageText,
    createdAt: r.createdAt,
  }))
}
