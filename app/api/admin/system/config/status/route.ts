import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import { handleApiError } from '@/lib/http/error-handler'
import { getExpectedWebhookEndpoint } from '@/lib/config/env'
import { withTimeout } from '@/lib/http/guards'

export const runtime = 'nodejs'

async function lineEndpointInfo(token: string) {
  const res = await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint', {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) return null
  return res.json() as Promise<{ endpoint?: string; active?: boolean }>
}

export async function GET(req: Request) {
  try {
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER', 'ADMIN', 'STAFF'])
    const envRow = await withTimeout(10_000, () => prisma.systemSetting.findUnique({ where: { key: 'settings:environment' }, select: { value: true } }))
    const val = envRow && envRow.value && typeof envRow.value === 'object' && !Array.isArray(envRow.value) ? (envRow.value as Record<string, unknown>) : {}
    const dbToken = typeof val.lineChannelToken === 'string' ? val.lineChannelToken.trim() : ''
    const dbSecret = typeof val.lineSecret === 'string' ? val.lineSecret.trim() : ''
    const dbUrl = typeof val.databaseUrl === 'string' ? val.databaseUrl.trim() : ''
    const envToken = (process.env['LINE_CHANNEL_TOKEN'] ?? process.env['LINE_CHANNEL_ACCESS_TOKEN'] ?? '').trim()
    const envSecret = (process.env['LINE_CHANNEL_SECRET'] ?? '').trim()
    const envDb = (process.env['DATABASE_URL'] ?? '').trim()
    const tokenInUse = dbToken || envToken
    const secretInUse = dbSecret || envSecret
    const tokenSource = dbToken ? 'settings' : envToken ? 'env' : 'none'
    const secretSource = dbSecret ? 'settings' : envSecret ? 'env' : 'none'
    const dbSource = 'env'
    let dbOk = false
    try {
      await withTimeout(10_000, () => prisma.$queryRaw`SELECT 1`)
      dbOk = true
    } catch {
      dbOk = false
    }
    let endpointInfo: { endpoint?: string; active?: boolean } | null = null
    if (tokenInUse) {
      try {
        endpointInfo = await withTimeout(10_000, () => lineEndpointInfo(tokenInUse))
      } catch {
        endpointInfo = null
      }
    }
    const expected = getExpectedWebhookEndpoint()
    const configured = endpointInfo?.endpoint ?? null
    const active = Boolean(endpointInfo?.active)
    const matches = Boolean(expected && configured && expected.replace(/\/+$/, '') === configured.replace(/\/+$/, ''))
    return NextResponse.json({
      ok: true,
      database: {
        inUseUrl: envDb || null,
        configuredInSettings: dbUrl || null,
        source: dbSource,
        connectionOk: dbOk
      },
      line: {
        token: { inUse: Boolean(tokenInUse), source: tokenSource },
        secret: { inUse: Boolean(secretInUse), source: secretSource }
      },
      webhook: {
        expected,
        configured,
        active,
        matches
      }
    })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
