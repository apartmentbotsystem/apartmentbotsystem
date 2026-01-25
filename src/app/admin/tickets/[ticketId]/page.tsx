import { getTicketDetail } from "@/infrastructure/tickets/ticketRead.service"
import { getTicketMessages } from "@/infrastructure/tickets/ticketMessageRead.service"
import ChatClient from "./ChatClient"

 

export default async function Page({ params }: { params: Promise<{ ticketId: string }> }) {
  const p = await params
  const ticket = await getTicketDetail(p.ticketId)
  const msgs = await getTicketMessages(p.ticketId)
  const initial = msgs.map((m) => ({
    id: m.id,
    direction: m.direction,
    messageText: m.messageText,
    createdAt: m.createdAt.toISOString(),
  }))
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="border-b p-3 flex items-center justify-between">
        <div className="text-sm">
          <div className="font-medium">Ticket {ticket.id}</div>
          <div className="text-gray-600">Source: LINE</div>
        </div>
        <div>
          <span
            className={`px-2 py-1 rounded-full text-xs ${
              ticket.status === "OPEN" ? "bg-green-100 text-green-800" : ticket.status === "IN_PROGRESS" ? "bg-yellow-100 text-yellow-800" : "bg-gray-200 text-gray-700"
            }`}
          >
            {ticket.status}
          </span>
        </div>
      </div>
      <ChatClient initialMessages={initial} ticketId={ticket.id} />
    </div>
  )
}
