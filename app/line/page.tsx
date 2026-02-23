import { prisma } from '@/lib/db'
import Link from 'next/link'
import * as AdminConversations from '@/services/adminConversations.service'
import ChatPanel from '@/app/line/ChatPanel'
import CreateTicketButton from './create-ticket-button'
import { getActiveMonth } from '@/lib/context'

export default async function LinePage({ searchParams }: { searchParams: { id?: string } }) {
  const { year, month } = await getActiveMonth()
  const consumptionDate = new Date(year, month - 2, 1)
  const consumptionYm = `${consumptionDate.getFullYear()}-${String(consumptionDate.getMonth() + 1).padStart(2, '0')}`

  const inbox = await AdminConversations.listInbox()

  const currentId = searchParams.id ?? inbox[0]?.id ?? ''
  const currentRaw = currentId
    ? await prisma.conversation.findUnique({
        where: { id: currentId },
        include: { messages: { orderBy: { createdAt: 'asc' } }, room: true, resident: true }
      })
    : null
  const current = currentRaw
    ? {
        ...currentRaw,
        messages: currentRaw.messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))
      }
    : null

  let replyDisabled = false
  if (current?.room?.number) {
    const [openCount, closedCount] = await Promise.all([
      prisma.ticket.count({ where: { roomNumber: current.room.number, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      prisma.ticket.count({ where: { roomNumber: current.room.number, status: 'CLOSED' } })
    ])
    replyDisabled = closedCount > 0 && openCount === 0
  }

  let latestBill: { ym: string; amount: number; paid: number; outstanding: number } | null = null
  if (current?.room?.number) {
    const rec = await prisma.billingRecord.findFirst({
      where: { roomNumber: current.room.number },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        amount: true,
        billingMonth: { select: { year: true, month: true } },
        payments: { where: { confirmed: true }, select: { matchedAmount: true } }
      }
    })
    if (rec) {
      const paid = rec.payments.reduce((s, p) => s + Number(p.matchedAmount), 0)
      latestBill = {
        ym: `${rec.billingMonth.year}-${String(rec.billingMonth.month).padStart(2, '0')}`,
        amount: Number(rec.amount),
        paid,
        outstanding: Number(rec.amount) - paid
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-sm opacity-80">บิล เดือน: {year}-{String(month).padStart(2, '0')} | รอบใช้หน่วย: {consumptionYm}</div>
      <div className="grid md:grid-cols-12 gap-3">
        <div className="md:col-span-3 border erp-border rounded overflow-hidden">
          <div className="px-3 py-2 border-b erp-border text-sm font-semibold">บทสนทนา</div>
          <div className="max-h-[70vh] overflow-auto">
            {inbox.map((c) => (
              <Link
                key={c.id}
                href={`/line?id=${c.id}`}
                className={`block px-3 py-2 border-b erp-border text-sm hover:bg-[var(--bg-surface)] ${c.id === currentId ? 'bg-[var(--bg-surface)]' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div>{c.displayName}</div>
                  {c.unreadAdmin > 0 && <span className="chip">{c.unreadAdmin}</span>}
                </div>
                <div className="opacity-60 text-xs">{c.lastMessage ?? ''}</div>
              </Link>
            ))}
          </div>
        </div>

        <div className="md:col-span-6 border erp-border rounded flex flex-col">
          <div className="px-3 py-2 border-b erp-border text-sm font-semibold">
            แชต {current?.room?.number ? <span className="ml-2 chip">ห้อง {current.room.number}</span> : null}
            <span className="ml-2 chip">บิล {year}-{String(month).padStart(2, '0')}</span>
          </div>
          {current ? (
            <ChatPanel
              conversationId={current.id}
              initialMessages={current.messages as unknown as Array<{ id: string; sender: 'ADMIN' | 'RESIDENT'; text: string; createdAt: string }>}
              replyDisabled={replyDisabled}
              disabledReason={replyDisabled ? 'ปิดการตอบกลับ: เคสทิกเก็ตถูกปิดแล้ว' : ''}
            />
          ) : (
            <div className="flex-1 overflow-auto p-3">
              <div className="text-sm opacity-70 p-3">เลือกบทสนทนาจากแถบด้านซ้าย</div>
            </div>
          )}
        </div>

        <div className="md:col-span-3 border erp-border rounded">
          <div className="px-3 py-2 border-b erp-border text-sm font-semibold">บริบท</div>
          {current ? (
            <div className="p-3 text-sm space-y-2">
              <div>ห้อง: <strong>{current.room?.number ?? '-'}</strong></div>
              <div>ผู้เช่า: <strong>{current.resident?.fullName ?? '-'}</strong></div>
              {latestBill && (
                <div className="p-2 border erp-border rounded">
                  <div className="opacity-70">บิลล่าสุด {latestBill.ym}</div>
                  <div>รวม: {latestBill.amount.toFixed(2)}</div>
                  <div>ชำระแล้ว: {latestBill.paid.toFixed(2)}</div>
                  <div>คงค้าง: {latestBill.outstanding.toFixed(2)}</div>
                </div>
              )}
              {current.room?.number && (
                <div className="flex gap-2 flex-wrap">
                  <Link href={`/admin/documents/generate?room=${current.room.number}`} className="px-2 py-1 border erp-border rounded text-xs">ลิงก์ใบแจ้งหนี้</Link>
                  <Link href={`/rooms/${encodeURIComponent(current.room.number)}`} className="px-2 py-1 border erp-border rounded text-xs">ลิงก์ห้อง</Link>
                  <CreateTicketButton roomNumber={current.room.number} residentId={current.resident?.id ?? undefined} />
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 text-sm opacity-70">ยังไม่ได้เลือกบทสนทนา</div>
          )}
        </div>
      </div>
    </div>
  )
}
