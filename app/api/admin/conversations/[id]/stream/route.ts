import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id = params.id
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      let stopped = false
      let lastIso = new Date(0).toISOString()

      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`))
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      async function tick() {
        try {
          const since = new Date(lastIso)
          const rows = await prisma.conversationMessage.findMany({
            where: { conversationId: id, createdAt: { gt: since } },
            orderBy: { createdAt: 'asc' },
            select: { id: true, sender: true, text: true, createdAt: true }
          })
          if (rows.length > 0) {
            lastIso = rows[rows.length - 1]!.createdAt.toISOString()
            send('messages', rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })))
          }
        } catch {
        } finally {
          if (!stopped) setTimeout(tick, 2000)
        }
      }

      const ka = setInterval(() => {
        controller.enqueue(encoder.encode(': keepalive\n\n'))
      }, 15000)

      tick()

      const anyReq = req as unknown as { signal?: AbortSignal }
      const signal = anyReq.signal
      if (signal) {
        signal.addEventListener('abort', () => {
          stopped = true
          clearInterval(ka)
          try { controller.close() } catch {}
        })
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  })
}
