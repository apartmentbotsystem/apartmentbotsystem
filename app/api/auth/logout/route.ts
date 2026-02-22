import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth/session'
import { handleApiError } from '@/lib/http/error-handler'

export async function POST() {
  try {
    await clearSessionCookie()
    return NextResponse.json({ ok: true })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}

