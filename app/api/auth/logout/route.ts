import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth/session'
import { handleApiError } from '@/lib/http/error-handler'
import { withTimeout } from '@/lib/http/guards'

export async function POST() {
  try {
    await withTimeout(10_000, () => clearSessionCookie())
    return NextResponse.json({ ok: true })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
