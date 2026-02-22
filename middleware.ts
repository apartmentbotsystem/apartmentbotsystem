import { NextResponse, NextRequest } from 'next/server'
import { getUserFromRequestEdge } from '@/lib/auth/session-edge'
import { verifyCsrfEdge } from '@/lib/http/csrf-edge'

const allowlist = new Set([
  '/api/health',
  '/api/system/health'
])

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }
  const mode = process.env['SYSTEM_MODE'] ?? 'normal'
  if (mode === 'read-only') {
    const method = req.method.toUpperCase()
    const isWrite = method === 'POST' || method === 'PATCH' || method === 'DELETE'
    const allowReadOnly = pathname === '/api/health' || pathname === '/api/system/health' || pathname.startsWith('/api/line/webhook') || pathname.startsWith('/api/webhook') || req.method === 'GET'
    if (isWrite && !allowReadOnly) {
      return NextResponse.json({ error: 'READ_ONLY_MODE', message: 'System in read-only mode' }, { status: 503 })
    }
  }
  if (allowlist.has(pathname) || pathname.startsWith('/api/line/webhook') || pathname.startsWith('/api/webhook')) {
    return NextResponse.next()
  }
  const user = await getUserFromRequestEdge(req)
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, { status: 401 })
  }
  if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'DELETE') {
    if (!pathname.startsWith('/api/line/webhook') && !pathname.startsWith('/api/webhook')) {
      if (!verifyCsrfEdge(req)) {
        return NextResponse.json({ error: 'CSRF', message: 'Invalid CSRF token' }, { status: 403 })
      }
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*']
}
