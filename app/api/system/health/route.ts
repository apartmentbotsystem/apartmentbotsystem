import { NextResponse } from 'next/server'
import { checkDatabaseConnection, checkDiskWriteAccess } from '@/lib/system/health'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'

export async function GET(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/system/health:GET')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const dbStatus = await checkDatabaseConnection()
    const diskOk = await checkDiskWriteAccess()
    return NextResponse.json({
      status: 'ok',
      db: dbStatus,
      disk: diskOk ? 'writable' : 'readonly',
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}

