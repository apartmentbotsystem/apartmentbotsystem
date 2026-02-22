import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { checkDatabaseConnection, getBackupFreshness, getLogDirectorySizeBytes } from '@/lib/system/health'
import { logger } from '@/lib/logging/file-logger'

export async function GET(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/health:GET')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const db = await checkDatabaseConnection()
    const uptime = Math.round(process.uptime())
    const version = process.env['APP_VERSION'] ?? 'unknown'
    const backup = await getBackupFreshness()
    const logSize = await getLogDirectorySizeBytes()
    const status = logSize > 200 * 1024 * 1024 ? 'degraded' : 'ok'
    const payload = { status, db, uptime, version, timestamp: new Date().toISOString(), backup, logSize }
    await logger.info('health check', payload)
    return NextResponse.json(payload)
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
