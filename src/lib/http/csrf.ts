import crypto from 'crypto'
import { cookies } from 'next/headers'

function generateToken(): string {
  return crypto.randomBytes(16).toString('hex')
}

export async function ensureCsrfCookie(): Promise<string> {
  const jar = await cookies()
  const existing = jar.get('csrf')?.value
  if (existing) return existing
  const token = generateToken()
  const secure = process.env.NODE_ENV === 'production' && process.env.E2E_ALLOW_ANY_USER !== 'true'
  jar.set('csrf', token, { httpOnly: false, secure, sameSite: 'lax', path: '/' })
  return token
}

export function verifyCsrf(req: Request): boolean {
  const header = req.headers.get('x-csrf-token')
  if (!header) return false
  const cookie = req.headers.get('cookie') ?? ''
  const m = cookie.match(/(?:^|;\s*)csrf=([^;]+)/)
  if (!m) return false
  try {
    const v = decodeURIComponent(m[1] ?? '')
    return v === header
  } catch {
    return false
  }
}
