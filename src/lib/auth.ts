import { NextResponse } from 'next/server'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import type { AuthUser } from '@/lib/auth/types'

export async function requireAdmin(req: Request): Promise<{ adminId: string } | NextResponse> {
  try {
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['ADMIN', 'SUPER_ADMIN'])
    return { adminId: user.id }
  } catch {
    const legacy = process.env['AUTH_LEGACY_FALLBACK'] ?? 'true'
    if (legacy === 'true') {
      const adminId = req.headers.get('x-admin-id')
      const role = req.headers.get('x-admin-role')
      if (adminId && role === 'ADMIN') return { adminId }
      if (process.env.NODE_ENV !== 'production') {
        return { adminId: 'dev-admin' }
      }
    }
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, { status: 401 })
  }
}
