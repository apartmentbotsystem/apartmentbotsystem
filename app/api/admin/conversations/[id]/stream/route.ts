import { prisma } from '@/lib/db'
import { createSignedUrl } from '@/infrastructure/storage/supabase'
import { logError } from '@/infrastructure/logger'

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
        let batchCount = 0
        try {
          const since = new Date(lastIso)
          const rows = await prisma.conversationMessage.findMany({
            where: { conversationId: id, createdAt: { gt: since } },
            orderBy: { createdAt: 'asc' },
            take: 200
          })
          batchCount = rows.length
          if (rows.length > 0) {
            lastIso = rows[rows.length - 1]!.createdAt.toISOString()
            const enriched = await Promise.all(rows.map(async (r) => {
              let mediaUrl = r.mediaUrl ?? null
              if (!mediaUrl && r.mediaPath) {
                try {
                  mediaUrl = await createSignedUrl('line-uploads', r.mediaPath, 60 * 60 * 24)
                } catch (e) {
                  try { logError('SSE_SIGNED_URL_FAILED', { error: e instanceof Error ? e.message : 'unknown' }) } catch {}
                }
              }
              return {
                id: r.id,
                sender: r.sender,
                text: r.text,
                createdAt: r.createdAt.toISOString(),
                mediaUrl,
                mediaType: r.mediaType,
                fileName: r.fileName,
                fileSize: r.fileSize ?? null
              }
            }))
            send('messages', enriched)
          }
        } catch {
        } finally {
          if (!stopped) {
            const delay = batchCount === 200 ? 0 : 2000
            setTimeout(tick, delay)
          }
        }
      }

      const ka = setInterval(() => {
        controller.enqueue(encoder.encode(': keepalive\n\n'))
      }, 15000)

      tick()

      const signal = req.signal
      if (signal) {
        signal.addEventListener('abort', () => {
          stopped = true
          clearInterval(ka)
          try { controller.close() } catch {}
        })
      }
    }
  })

  // Wrap response creation in a timeout guard without altering the long-lived stream behavior
  const resp = await (await import('@/lib/http/guards')).withTimeout(10_000, async () => {
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive'
      }
    })
  })

  return resp
}
