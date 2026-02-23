/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: false
  },
  reactStrictMode: true,
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
    const securityHeaders = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
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
