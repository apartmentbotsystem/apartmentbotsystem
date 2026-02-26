import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { z } from 'zod'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import * as Payments from '@/services/payments'
import type { AuthUser } from '@/lib/auth/types'
import { handleApiError } from '@/lib/http/error-handler'
import { checkRateLimitCustom, getClientIp } from '@/lib/http/rate-limit'
import { withTimeout } from '@/lib/http/guards'
import { verifyCsrf } from '@/lib/http/csrf'

export const runtime = 'nodejs'

const metaSchema = z.object({
  sheet: z.string().optional()
})

export async function POST(req: Request) {
  try {
    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER', 'ADMIN'])
    if (!verifyCsrf(req)) return NextResponse.json({ error: 'CSRF', message: 'Invalid CSRF token' }, { status: 403 })
    const rl = checkRateLimitCustom(`${getClientIp(req)}:${user.id}:/api/payments/import:POST`, 5000, 10)
    if (!rl.allowed) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })
    const imported = await withTimeout(10_000, async () => {
      const form = await req.formData()
      const file = form.get('file')
      const meta = metaSchema.safeParse({
        sheet: form.get('sheet') ?? undefined
      })
      if (!(file instanceof Blob)) return 0
      const buf = Buffer.from(await file.arrayBuffer())
      const wb = XLSX.read(buf, { type: 'buffer' })
      const sheetName = (meta.success && meta.data.sheet ? meta.data.sheet : wb.SheetNames[0]) as string
      const ws = wb.Sheets[sheetName as keyof typeof wb.Sheets]
      if (!ws) return 0
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws as XLSX.WorkSheet, { header: 1 })
      if (!rows.length) return 0
      const headers = (rows[0] ?? []).map(v => String(v ?? '').trim().toLowerCase())
      const idxAmount = headers.findIndex(h => /(amount|ยอด|จำนวนเงิน)/.test(h))
      const idxDate = headers.findIndex(h => /(date|วันที่|occurred|posted)/.test(h))
      const idxRef = headers.findIndex(h => /(ref|reference|หมายเหตุ|รายละเอียด|bank|ธนาคาร)/.test(h))
      let importedCount = 0
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r] ?? []
        const amountRaw = row[idxAmount]
        const dateRaw = row[idxDate]
        const refRaw = idxRef >= 0 ? row[idxRef] : null
        if (amountRaw == null || dateRaw == null) continue
        const amount = Number(String(amountRaw).replace(/[,\s฿]/g, ''))
        const occurredAt = new Date(String(dateRaw))
        if (!Number.isFinite(amount) || isNaN(occurredAt.getTime())) continue
        await Payments.importPayment(user, amount, occurredAt, refRaw ? String(refRaw) : null, user.id)
        importedCount++
      }
      return importedCount
    })
    return NextResponse.json({ ok: true, imported })
  } catch (err) {
    const http = handleApiError(err)
    return NextResponse.json(http.body, { status: http.status })
  }
}
