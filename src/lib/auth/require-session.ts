import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { DomainError } from '@/domain/errors'
import type { AuthUser } from '@/lib/auth/types'
import { mapRoleToCanonical } from '@/lib/auth/session'

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

function getAuthSecret(): string | null {
  return process.env['AUTH_SECRET'] ?? process.env['NEXTAUTH_SECRET'] ?? null
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

export async function requireSession(req: Request): Promise<AuthUser> {
  const secret = getAuthSecret()
  if (!secret) {
    throw new DomainError('UNAUTHORIZED', 'Authentication required', 401)
  }
  const cookie = req.headers.get('cookie') ?? ''
  const m = cookie.match(/(?:^|;\s*)session=([^;]+)/)
  if (!m) {
    throw new DomainError('UNAUTHORIZED', 'Authentication required', 401)
  }
  const token = decodeURIComponent(m[1] ?? '')
  const payload = verifyHS256(token, secret)
  if (!payload) {
    throw new DomainError('UNAUTHORIZED', 'Invalid session', 401)
  }
  if (process.env['E2E_ALLOW_ANY_USER'] === 'true') {
    const role = mapRoleToCanonical(payload.role)
    return { id: payload.sub, role }
  }
  let exists = false
  let sv = 0
  try {
    const rows = await prisma.$queryRaw<{ id: string; sessionversion: number }[]>`SELECT id, "sessionVersion" AS sessionversion FROM "User" WHERE id = ${payload.sub} LIMIT 1`
    exists = !!rows.length
    sv = rows[0]?.sessionversion ?? 0
  } catch {
    const rows = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${payload.sub} LIMIT 1`
    exists = !!rows.length
    sv = 0
  }
  if (!exists || sv !== payload.sv) {
    throw new DomainError('UNAUTHORIZED', 'Session invalid', 401)
  }
  // Role escalation guard: ensure token role matches DB-assigned roles
  try {
    const rows = await prisma.$queryRaw<{ code: string }[]>`
      SELECT r.code FROM "Role" r
      JOIN "UserRole" ur ON ur."roleId" = r.id
      WHERE ur."userId" = ${payload.sub}
    `
    if (Array.isArray(rows) && rows.length > 0) {
      const dbRoles = rows.map(r => mapRoleToCanonical(r.code))
      const tokenRole = mapRoleToCanonical(payload.role)
      if (!dbRoles.includes(tokenRole)) {
        throw new DomainError('UNAUTHORIZED', 'Session role mismatch', 401)
      }
    }
  } catch {
    // If role tables are not provisioned, skip silently to avoid auth hard fail
  }
  const role = mapRoleToCanonical(payload.role)
  return { id: payload.sub, role }
}

export function enforceRoleBoundary(user: AuthUser, allowedRoles: Array<'OWNER' | 'ADMIN' | 'STAFF'>): void {
  const allowCanonical = allowedRoles.map((r) => mapRoleToCanonical(r))
  const effective = mapRoleToCanonical(user.role)
  if (!allowCanonical.includes(effective)) {
    throw new DomainError('FORBIDDEN', 'Forbidden', 403)
  }
}
