import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSession, setSessionCookie } from '@/lib/auth/session'
import { ensureCsrfCookie } from '@/lib/http/csrf'
import { handleApiError } from '@/lib/http/error-handler'
import { prisma } from '@/lib/db'
import { verifyPassword } from '@/lib/auth/password'

const schema = z.object({
  userId: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(1).optional(),
  role: z.enum(['OWNER', 'ADMIN', 'STAFF', 'SUPER_ADMIN', 'FINANCE', 'MANAGER', 'ACCOUNTANT', 'VIEWER']).optional(),
  sessionVersion: z.number().int().nonnegative().default(0)
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parse = schema.safeParse(body)
    if (!parse.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'Invalid body' }, { status: 422 })

    const e2eBypassEnabled = process.env['E2E_ALLOW_ANY_USER'] === 'true'
    let userId = parse.data.userId ?? ''
    let role = parse.data.role ?? 'ADMIN'
    let sessionVersion = parse.data.sessionVersion

    if (userId && !e2eBypassEnabled) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Direct userId login disabled' }, { status: 403 })
    }

    if (!userId && parse.data.email) {
      const user = await prisma.user.findUnique({
        where: { email: parse.data.email },
        select: {
          id: true,
          passwordHash: true,
          sessionVersion: true,
          userRoles: { include: { role: { select: { code: true } } } }
        }
      })
      if (!user || !verifyPassword(parse.data.password ?? '', user.passwordHash)) {
        return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Invalid credentials' }, { status: 401 })
      }
      userId = user.id
      // prefer server-side value from DB
      sessionVersion = user.sessionVersion ?? 0
      const roleCodes = user.userRoles.map((ur) => ur.role.code)
      if (roleCodes.includes('OWNER') || roleCodes.includes('SUPER_ADMIN')) role = 'OWNER'
      else if (roleCodes.includes('ADMIN') || roleCodes.includes('MANAGER') || roleCodes.includes('FINANCE') || roleCodes.includes('ACCOUNTANT')) role = 'ADMIN'
      else role = 'STAFF'
    }

    if (!userId) {
      return NextResponse.json({ error: 'UNPROCESSABLE', message: 'userId or email is required' }, { status: 422 })
    }

    const token = await createSession(userId, role, sessionVersion)
    await setSessionCookie(token)
    await ensureCsrfCookie()
    return NextResponse.json({ ok: true, userId, role })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
