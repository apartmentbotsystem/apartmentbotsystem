/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: false
  },
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    return [
      { source: '/admin/generate', destination: '/admin/documents/generate', permanent: true },
      { source: '/admin/analytics', destination: '/analytics', permanent: true },
      { source: '/admin/billing', destination: '/billing', permanent: true },
      { source: '/admin/billing/:year/:month', destination: '/billing', permanent: true },
      { source: '/admin/payments', destination: '/payments', permanent: true },
      { source: '/admin/messages', destination: '/line', permanent: true },
      { source: '/admin/messages/:id', destination: '/line?id=:id', permanent: true }
    ]
  },
  async headers() {
    const isProd = process.env.NODE_ENV === 'production'
    const scriptSrc = isProd ? "script-src 'self'" : "script-src 'self' 'unsafe-eval' blob:"
    const connectSrc = isProd ? "connect-src 'self'" : "connect-src 'self' ws: wss:"
    const styleSrc = isProd ? "style-src 'self' 'unsafe-inline'" : "style-src 'self' 'unsafe-inline' blob:"
    const workerSrc = isProd ? null : "worker-src 'self' blob:"
    const csp = [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      scriptSrc,
      connectSrc,
      styleSrc,
      "font-src 'self' data:",
      "frame-ancestors 'none'"
    ]
    if (workerSrc) csp.push(workerSrc)
    const cspValue = csp.join('; ')
    const securityHeaders = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
      { key: 'Content-Security-Policy', value: cspValue },
      ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : [])
    ]
    return [
      {
        source: '/:path*',
        headers: securityHeaders
      }
    ]
  }
}

export default nextConfig
