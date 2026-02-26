import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { prisma } from '@/lib/db'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { getHealthSnapshot } from '@/services/system'
import { withTimeout } from '@/lib/http/guards'

const execp = promisify(exec)
let migrated = false

async function migrateOnce() {
  if (migrated) return
  try {
    const flag = await prisma.systemSetting.findUnique({ where: { key: 'system:boot:migrated' } })
    if (!flag) {
      await execp('npx prisma migrate deploy', { env: process.env, timeout: 120000 })
      await prisma.systemSetting.upsert({
        where: { key: 'system:boot:migrated' },
        update: { value: { migratedAt: new Date().toISOString() } },
        create: { key: 'system:boot:migrated', value: { migratedAt: new Date().toISOString() } }
      })
    }
    migrated = true
  } catch (e) {
    // Do not crash health; report in payload
  }
}

export async function GET(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/system/health:GET')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    await withTimeout(10_000, () => migrateOnce())
    const snapshot = await withTimeout(10_000, () => getHealthSnapshot())
    if (snapshot.building.count > 1) {
      console.error('[FATAL] Multiple buildings detected. System requires single-building mode.')
    }
    return NextResponse.json({
      status: 'ok',
      ...snapshot,
      migrated,
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
