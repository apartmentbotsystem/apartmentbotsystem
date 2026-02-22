import { cookies } from 'next/headers'
import crypto from 'crypto'
import { prisma } from '@/lib/db'

type JwtPayload = {
  sub: string
  role: string
  sv: number
  exp: number
}

function b64url(input: Buffer | string): string {
  const base = (input instanceof Buffer ? input : Buffer.from(input)).toString('base64')
  return base.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function signHS256(header: object, payload: object, secret: string): string {
  const h = b64url(JSON.stringify(header))
  const p = b64url(JSON.stringify(payload))
  const data = `${h}.${p}`
  const sig = crypto.createHmac('sha256', secret).update(data).digest()
  return `${data}.${b64url(sig)}`
}

function verifyHS256(token: string, secret: string): JwtPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const h = parts[0] ?? ''
  const p = parts[1] ?? ''
  const s = parts[2] ?? ''
  const data = `${h}.${p}`
  const expected = b64url(crypto.createHmac('sha256', secret).update(data).digest())
  if (s !== expected) return null
  try {
    const json = Buffer.from(p, 'base64').toString('utf8')
    const payload = JSON.parse(json) as JwtPayload
    if (typeof payload.exp !== 'number' || Date.now() / 1000 >= payload.exp) return null
    return payload
  } catch {
    return null
  }
}

export async function createSession(userId: string, role: string, sessionVersion: number, maxAgeMinutes = 20): Promise<string> {
  const secret = process.env['AUTH_SECRET']
  if (!secret) throw new Error('AUTH_SECRET missing')
  const exp = Math.floor(Date.now() / 1000) + maxAgeMinutes * 60
  const token = signHS256({ alg: 'HS256', typ: 'JWT' }, { sub: userId, role, sv: sessionVersion, exp }, secret)
  return token
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies()
  jar.set('session', token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' })
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies()
  jar.set('session', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
}

export async function getUserFromRequest(req: Request): Promise<{ id: string; role: string } | null> {
  const secret = process.env['AUTH_SECRET']
  if (!secret) return null
  const cookie = req.headers.get('cookie') ?? ''
  const m = cookie.match(/(?:^|;\s*)session=([^;]+)/)
  if (!m) {
    return null
  }
  const token = decodeURIComponent(m[1] ?? '')
  const payload = verifyHS256(token, secret)
  if (!payload) return null
  // SessionVersion verification with fallback if column missing
  try {
    const rows = await prisma.$queryRaw<{ sessionversion: number }[]>`SELECT "sessionVersion" AS sessionversion FROM "User" WHERE id = ${payload.sub} LIMIT 1`
    const sv = rows[0]?.sessionversion ?? 0
    if (sv !== payload.sv) return null
  } catch {
    // Column may not exist yet during migration; allow temporarily
  }
  return { id: payload.sub, role: payload.role }
}

export function mapRoleToLegacy(role: string): 'ADMIN' | 'MANAGER' | 'ACCOUNTANT' | 'STAFF' {
  switch (role) {
    case 'SUPER_ADMIN': return 'ADMIN'
    case 'FINANCE': return 'ACCOUNTANT'
    case 'VIEWER': return 'STAFF'
    default: return (role as any) // legacy roles already
  }
}

export function getUserFromRequestSync(req: Request): { id: string; role: string } | null {
  const secret = process.env['AUTH_SECRET']
  if (!secret) return null
  const cookie = req.headers.get('cookie') ?? ''
  const m = cookie.match(/(?:^|;\s*)session=([^;]+)/)
  if (!m) return null
  const token = decodeURIComponent(m[1] ?? '')
  const payload = verifyHS256(token, secret)
  if (!payload) return null
  return { id: payload.sub, role: payload.role }
}
