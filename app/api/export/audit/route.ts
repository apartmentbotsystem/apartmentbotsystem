import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { AuditLog } from '@prisma/client'
import { logger } from '@/lib/logging/file-logger'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { logAudit } from '@/services/audit'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/export/audit:GET')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['SUPER_ADMIN', 'FINANCE'])
    const adminId = user.id
    const filename = `audit-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`
    await logger.info('audit export requested', { adminId })
    await logAudit({ actorId: adminId, action: 'EXPORT_AUDIT', entity: 'Export' })
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const enc = new TextEncoder()
        controller.enqueue(enc.encode('id,action,entityType,entityId,createdAt,data\n'))
        let cursor: string | undefined = undefined
        while (true) {
          const rows: AuditLog[] = await prisma.auditLog.findMany({
            orderBy: { id: 'asc' },
            take: 1000,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
          })
          if (!rows.length) break
          for (const a of rows) {
            const line = [
              a.id,
              a.action,
              a.entityType,
              a.entityId,
              new Date(a.createdAt).toISOString(),
              a.data ? JSON.stringify(a.data) : ''
            ].map(s => `"${String(s).replace(/"/g, '""')}"`).join(',') + '\n'
            controller.enqueue(enc.encode(line))
          }
          cursor = rows[rows.length - 1]?.id
          if (!cursor) break
        }
        controller.close()
        await logger.info('audit export completed', { adminId })
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
