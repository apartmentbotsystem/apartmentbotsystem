import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'

export async function GET() {
  let db = 'ok'
  let xlsx = 'ok'
  try {
    await (await import('@/lib/http/guards')).withTimeout(10_000, () => prisma.$queryRawUnsafe('SELECT 1'))
  } catch {
    db = 'error'
  }
  try {
    if (typeof XLSX.read !== 'function' || typeof XLSX.utils !== 'object') throw new Error('xlsx not ready')
    // minimalist check: create empty book/sheet and to_json
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([['ok']])
    XLSX.utils.book_append_sheet(wb, ws, 'S')
    XLSX.utils.sheet_to_json(ws, { header: 1 })
  } catch {
    xlsx = 'error'
  }
  return NextResponse.json({ ok: true, db, xlsx, memory: process.memoryUsage().heapUsed, uptime: process.uptime() })
}
