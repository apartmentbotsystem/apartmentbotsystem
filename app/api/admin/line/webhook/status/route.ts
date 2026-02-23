import { NextResponse } from 'next/server'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import { handleApiError } from '@/lib/http/error-handler'
import { getLineAccessTokenPreferDb, getExpectedWebhookEndpoint } from '@/lib/config/env'

export const runtime = 'nodejs'

function expectedEndpoint(): string | null {
  return getExpectedWebhookEndpoint()
}

async function fetchWebhookInfo(token: string) {
  const res = await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LINE_ENDPOINT_INFO_FAILED:${res.status}:${text}`)
  }
  return res.json() as Promise<{ endpoint?: string; active?: boolean }>
}

export async function GET(req: Request) {
  try {
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER', 'ADMIN', 'STAFF'])
    let tokenOk = true
    let token = ''
    try {
      token = await getLineAccessTokenPreferDb()
    } catch {
      tokenOk = false
    }
    const exp = expectedEndpoint()
    let info: { endpoint?: string; active?: boolean } | null = null
    if (tokenOk) {
      try {
        info = await fetchWebhookInfo(token)
      } catch {
        info = null
      }
    }
    const configured = info?.endpoint ?? null
    const active = Boolean(info?.active)
    const matches = Boolean(exp && configured && configured.replace(/\/+$/, '') === exp.replace(/\/+$/, ''))
    return NextResponse.json({
      ok: true,
      tokenConfigured: tokenOk,
      expected: exp,
      configured,
      active,
      matches
    })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER', 'ADMIN', 'STAFF'])
    const token = await getLineAccessTokenPreferDb()
    const res = await fetch('https://api.line.me/v2/bot/channel/webhook/test', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })
    const json = await res.json().catch(() => ({} as unknown))
    const ok = res.ok && (json as { success?: boolean }).success !== false
    return NextResponse.json({ ok, response: json })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
