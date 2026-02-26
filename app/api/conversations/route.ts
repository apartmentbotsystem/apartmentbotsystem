import { NextResponse } from 'next/server'
import { withTimeout } from '@/lib/http/guards'

export async function GET() {
  const payload = await withTimeout(10_000, async () => ({ error: 'DEPRECATED' as const }))
  return NextResponse.json(payload, { status: 410 })
}
