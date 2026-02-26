import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { Payment } from '@prisma/client'
import { logInfo } from '@/infrastructure/logger'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { logAudit } from '@/services/audit'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import { clampLimitFromRequest, withTimeout } from '@/lib/http/guards'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/export/payments:GET')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER', 'ADMIN'])
    const adminId = user.id
    const filename = `payments-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`
    logInfo('payments export requested', { adminId })
    await logAudit({ actorId: adminId, action: 'EXPORT_PAYMENTS', entity: 'Export' })
    const limit = clampLimitFromRequest(req, 50, 200)
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        await withTimeout(10_000, async () => {
          const enc = new TextEncoder()
          controller.enqueue(enc.encode('id,amount,bankRef,occurredAt,matched\n'))
          let cursor: string | undefined = undefined
          let exported = 0
          while (true) {
            const rows: Payment[] = await prisma.payment.findMany({
              orderBy: { id: 'asc' },
              take: Math.min(1000, Math.max(1, limit - exported)),
              ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
            })
            if (!rows.length) break
            for (const p of rows) {
              const line = [
                p.id,
                String(p.amount),
                p.bankRef ?? '',
                new Date(p.occurredAt).toISOString(),
                p.matched ? 'true' : 'false'
              ].map(s => `"${String(s).replace(/"/g, '""')}"`).join(',') + '\n'
              controller.enqueue(enc.encode(line))
              exported++
              if (exported >= limit) break
            }
            if (exported >= limit) break
            cursor = rows[rows.length - 1]?.id
            if (!cursor) break
          }
          controller.close()
          logInfo('payments export completed', { adminId })
        })
      }
    })
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
