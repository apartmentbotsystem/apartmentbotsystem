import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { BillingRecord } from '@prisma/client'
import { logger } from '@/lib/logging/file-logger'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { logAudit } from '@/services/audit'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/export/billing:GET')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER', 'ADMIN'])
    const adminId = user.id
    const url = new URL(req.url)
    const year = url.searchParams.get('year')
    const month = url.searchParams.get('month')
    const filter: { year?: number; month?: number } = {}
    if (year) filter.year = Number(year)
    if (month) filter.month = Number(month)
    const filename = `billing-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`
    await logger.info('billing export requested', { adminId, filter })
    await logAudit({ actorId: adminId, action: 'EXPORT_BILLING', entity: 'Export', metadata: filter })
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const enc = new TextEncoder()
        controller.enqueue(enc.encode('id,roomNumber,year,month,amount,adjustments,penalty,status,dueDate,updatedAt\n'))
        const bm = await prisma.billingMonth.findMany({
          where: { ...(filter.year ? { year: filter.year } : {}), ...(filter.month ? { month: filter.month } : {}) },
          orderBy: [{ year: 'asc' }, { month: 'asc' }],
          select: { id: true, year: true, month: true }
        })
        for (const m of bm) {
          let cursor: string | undefined = undefined
          while (true) {
            const rows: BillingRecord[] = await prisma.billingRecord.findMany({
              where: { billingMonthId: m.id },
              orderBy: { id: 'asc' },
              take: 1000,
              ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
            })
            if (!rows.length) break
            for (const r of rows) {
              const line = [
                r.id,
                r.roomNumber,
                String(m.year),
                String(m.month),
                String(r.amount),
                String(r.adjustments),
                String(r.penalty ?? 0),
                r.status,
                r.dueDate ? new Date(r.dueDate).toISOString() : '',
                new Date(r.updatedAt).toISOString()
              ].map(s => `"${String(s).replace(/"/g, '""')}"`).join(',') + '\n'
              controller.enqueue(enc.encode(line))
            }
            cursor = rows[rows.length - 1]?.id
            if (!cursor) break
          }
        }
        controller.close()
        await logger.info('billing export completed', { adminId, filter })
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
