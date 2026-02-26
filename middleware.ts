import { NextResponse, NextRequest } from 'next/server'
import { getUserFromRequestEdge } from '@/lib/auth/session-edge'
import { verifyCsrfEdge } from '@/lib/http/csrf-edge'

const allowlist = new Set([
  '/api/auth/login',
  '/api/auth/logout'
])

// Dev-only in-memory rate limiter for /api/*
const DEV_WINDOW_MS = 60_000
const DEV_LIMIT = 60
const devBuckets = new Map<string, { count: number; windowStart: number }>()
function devRateLimit(ip: string, route: string): boolean {
  const key = `${ip}:${route}`
  const now = Date.now()
  const rec = devBuckets.get(key)
  if (!rec || now - rec.windowStart >= DEV_WINDOW_MS) {
    devBuckets.set(key, { count: 1, windowStart: now })
    return true
  }
  if (rec.count >= DEV_LIMIT) return false
  rec.count++
  return true
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isApi = pathname.startsWith('/api/')
  const isWebhook = pathname.startsWith('/api/line/webhook') || pathname.startsWith('/api/webhook')
  const isSensitiveGroup =
    pathname.startsWith('/api/billing') ||
    pathname.startsWith('/api/payments') ||
    pathname.startsWith('/api/documents') ||
    pathname.startsWith('/api/system') ||
    pathname.startsWith('/api/inbox') ||
    pathname.startsWith('/api/admin')
  const isStaticAsset =
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/manifest.json' ||
    /\.(?:css|js|mjs|map|png|jpe?g|gif|svg|ico|webp|avif|woff2?|ttf|otf|txt|xml|json)$/i.test(pathname)

  if (!isApi) {
    const user = await getUserFromRequestEdge(req)

    if (isStaticAsset) {
      // Allow static assets to be served without login
      return NextResponse.next()
    }

    const isLoginPath = pathname === '/login' || pathname === '/login/'
    const isSetupPath = pathname === '/setup' || pathname.startsWith('/setup/')
    if (isLoginPath) {
      return NextResponse.next()
    }
    if (isSetupPath) {
      try {
        // Soft guard: deny /setup if already installed
        const { isInstalled } = await import('@/lib/system/install')
        const installed = await isInstalled()
        if (installed) {
          const url = new URL('/login', req.url)
          return NextResponse.redirect(url)
        }
      } catch {}
      return NextResponse.next()
    }

    if (!user) {
      const url = new URL('/login', req.url)
      const next = `${pathname}${req.nextUrl.search ?? ''}`
      url.searchParams.set('next', next)
      return NextResponse.redirect(url)
    }
    // Role guard for admin/system pages
    const needsSystemRole = pathname.startsWith('/admin/system/')
    if (needsSystemRole) {
      if (!user) {
        const url = new URL('/login', req.url)
        url.searchParams.set('next', pathname)
        return NextResponse.redirect(url)
      }
      const allowed: Array<string> = ['OWNER', 'ADMIN']
      if (!allowed.includes(String(user.role))) {
        return NextResponse.redirect(new URL('/403', req.url))
      }
    }
    return NextResponse.next()
  }
  // Skip internal actions and webhooks; apply dev-only basic limiter
  if (process.env.NODE_ENV !== 'production') {
    const skip = req.headers.get('x-internal-action') === '1' || isWebhook
    if (!skip) {
      const ip = req.ip ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
      if (!devRateLimit(ip, pathname)) {
        return NextResponse.json({ ok: false, error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
      }
    }
  }
  // Sensitive POST limiter: 10 req / 5s per IP + per user
  if (req.method === 'POST' && isSensitiveGroup && !isWebhook) {
    const user = await getUserFromRequestEdge(req)
    const ip = req.ip ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const userKey = user?.id ?? 'anonymous'
    const key = `${ip}:${userKey}:${pathname}`
    const now = Date.now()
    const win = 5000
    const lim = 10
    const map = (globalThis as unknown as Record<string, Map<string, { c: number; t: number }>>).__sensitiveLimit
      ?? new Map<string, { c: number; t: number }>()
    if (!(globalThis as unknown as Record<string, Map<string, { c: number; t: number }>>).__sensitiveLimit) {
      ;(globalThis as unknown as Record<string, Map<string, { c: number; t: number }>>).__sensitiveLimit = map
    }
    const rec = map.get(key)
    if (!rec || now - rec.t >= win) {
      map.set(key, { c: 1, t: now })
    } else {
      if (rec.c >= lim) {
        return NextResponse.json({ ok: false, error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
      }
      rec.c++
    }
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
  if (allowlist.has(pathname) || isWebhook) {
    return NextResponse.next()
  }
  // Fatal integrity: multi-building detected -> read-only hard lock
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    try {
      const { getFatalStateDetail } = await import('@/lib/system/integrity')
      const detail = await getFatalStateDetail()
      if (detail.fatal) return NextResponse.json({ status: 'SYSTEM_LOCKED', reason: detail.reason }, { status: 503 })
    } catch { /* ignore */ }
  }
  const user = await getUserFromRequestEdge(req)
  if (!user) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED', message: 'Authentication required' }, { status: 401 })
  }
  // Role guard for system APIs
  if (pathname.startsWith('/api/system/')) {
    const allowed: Array<string> = ['OWNER', 'ADMIN']
    if (!allowed.includes(String(user.role))) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN', message: 'Insufficient permissions' }, { status: 403 })
    }
  }
  if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'DELETE') {
    if (!isWebhook) {
      if (!verifyCsrfEdge(req)) {
        return NextResponse.json({ ok: false, error: 'CSRF', message: 'Invalid CSRF token' }, { status: 403 })
      }
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/:path*']
}
