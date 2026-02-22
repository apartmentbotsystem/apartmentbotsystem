import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { z } from 'zod'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as Billing from '@/services/billing'
import { handleApiError } from '@/lib/http/error-handler'
import type { AuthUser } from '@/lib/auth/types'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { ensureIdempotent, sha256Hex } from '@/lib/http/idempotency'

export const runtime = 'nodejs'

const metaSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12)
})

function detectColumns(headers: string[]) {
  const lower = headers.map((h) => h.toLowerCase())
  let roomIdx = lower.findIndex((h) => /(room|ห้อง|หมายเลข|เลข)/.test(h))
  if (roomIdx === -1) roomIdx = 0
  let amountIdx = lower.findIndex((h) => /(amount|ยอด|total|รวม|ค่า)/.test(h))
  if (amountIdx === -1) amountIdx = 1
  return { roomIdx, amountIdx }
}

export async function POST(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/billing/import:POST')
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['SUPER_ADMIN', 'FINANCE'])
    const form = await req.formData()
    const file = form.get('file')
    const meta = metaSchema.safeParse({
      year: form.get('year'),
      month: form.get('month')
    })
    if (!meta.success) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'year/month ไม่ถูกต้อง' }, { status: 422 })
    if (!(file instanceof Blob)) return NextResponse.json({ error: 'UNPROCESSABLE', message: 'กรุณาแนบไฟล์ Excel' }, { status: 422 })

    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer' })

    const { year, month } = meta.data
    const idemKey = req.headers.get('Idempotency-Key')
    const payloadHash = sha256Hex(Buffer.concat([
      Buffer.from(JSON.stringify({ year, month, user: user.id })),
      buf
    ]))
    const { reused, result } = await ensureIdempotent('/api/billing/import', idemKey, payloadHash, async () => {
      const bm = await Billing.ensureBillingMonth(year, month)
  
      let processed = 0
      for (let i = 0; i < wb.SheetNames.length; i++) {
        const sheetName = wb.SheetNames[i] as string
        const ws = wb.Sheets[sheetName] as XLSX.WorkSheet
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })
        if (!rows.length) continue
        const headers = (rows[0] ?? []).map((v) => String(v ?? '')).filter((v) => v.length > 0)
        const { roomIdx, amountIdx } = detectColumns(headers)
        const floorNo = Number.parseInt(String(sheetName).replace(/\D+/g, ''), 10) || i + 1
        const floor = await Billing.ensureFloor(floorNo, `ชั้น ${floorNo}`)
        for (let r = 1; r < rows.length; r++) {
          const row = Array.isArray(rows[r]) ? (rows[r] as unknown[]) : []
          if (!row) continue
          const roomRaw = row[roomIdx]
          const amountRaw = row[amountIdx]
          if (roomRaw == null || amountRaw == null) continue
          const roomNumber = String(roomRaw).trim()
          if (!roomNumber) continue
          const amountNum = Number(
            String(amountRaw).replace(/[,\s฿]/g, '')
          )
          if (Number.isNaN(amountNum)) continue
          const raw: Record<string, unknown> = {}
          for (let c = 0; c < headers.length; c++) {
            const key = headers[c]
            if (!key) continue
            const val = row[c]
            raw[key] = val
            const norm = key.trim().replace(/\s+/g, '_')
            if (norm !== key) raw[norm] = val
          }
          const room = await Billing.ensureRoom(roomNumber, floor.id)
          await Billing.upsertBillingRecord(bm.id, room.number, amountNum, raw)
          processed++
        }
      }
      return { ok: true, year, month, processed }
    })
    return NextResponse.json(result)
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
