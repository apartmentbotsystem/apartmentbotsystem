import { NextResponse, NextRequest } from 'next/server'
import { getUserFromRequestEdge } from '@/lib/auth/session-edge'
import { verifyCsrfEdge } from '@/lib/http/csrf-edge'

const allowlist = new Set([
  '/api/health',
  '/api/health/import',
  '/api/system/health',
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

    if (pathname === '/login') {
      const hasError = req.nextUrl.searchParams.get('error') === '1'
      if (user && !hasError) return NextResponse.redirect(new URL('/dashboard', req.url))
      return NextResponse.next()
    }

    if (!user) {
      const url = new URL('/login', req.url)
      const next = `${pathname}${req.nextUrl.search ?? ''}`
      url.searchParams.set('next', next)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }
  // Skip internal actions and webhooks; apply dev-only basic limiter
  if (process.env.NODE_ENV !== 'production') {
    const skip = req.headers.get('x-internal-action') === '1' || isWebhook
    if (!skip) {
      const ip = req.ip ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
      if (!devRateLimit(ip, pathname)) {
        return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
      }
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
  const user = await getUserFromRequestEdge(req)
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, { status: 401 })
  }
  if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'DELETE') {
    if (!isWebhook) {
      if (!verifyCsrfEdge(req)) {
        return NextResponse.json({ error: 'CSRF', message: 'Invalid CSRF token' }, { status: 403 })
      }
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/:path*']
}
