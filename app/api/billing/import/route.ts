import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession, enforceRoleBoundary } from '@/lib/auth/require-session'
import { checkRateLimit, getClientIp } from '@/lib/http/rate-limit'
import * as ImportSvc from '@/services/billingImport'
import { REQUIRED_BILLING_HEADERS } from '@/domain/billing/excelSchema'

export const runtime = 'nodejs'

const metaSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  strict: z.coerce.boolean().optional().default(false),
  headerMapping: z.record(z.string(), z.string()).optional()
})

export async function POST(req: Request) {
  try {
    const rl = checkRateLimit(getClientIp(req), '/api/billing/import:POST')
    if (!rl.allowed) return NextResponse.json({ ok: false, code: 'RATE_LIMIT', message: 'Too many requests' }, { status: 429 })

    const user = await requireSession(req)
    enforceRoleBoundary(user, ['OWNER', 'ADMIN'])

    if (REQUIRED_BILLING_HEADERS.length !== 22) {
      return NextResponse.json({ ok: false, code: 'IMPORT_SCHEMA_INVALID', message: 'header schema misconfigured' }, { status: 500 })
    }

    const ct = req.headers.get('content-type') ?? ''
    let buf: Buffer
    const isJson = ct.includes('application/json')

    const meta = isJson
      ? await parseJsonMeta(req)
      : await parseFormMeta(req)

    if (!meta.ok) {
      return NextResponse.json({ ok: false, code: 'UNPROCESSABLE', message: meta.message }, { status: 422 })
    }

    buf = meta.file
    const { year, month, strict, headerMapping } = meta.data
    const result = await ImportSvc.runImport(user, { year, month, fileBuf: buf, strict, headerMapping })

    if (!result.ok) {
      const status = (result.code === 'IMPORT_ALREADY_SUCCESS' || result.code === 'IMPORT_EXISTS_PROCESSING') ? 409 : 400
      return NextResponse.json(result, { status })
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ ok: false, code: 'IMPORT_FATAL', message: String(err) }, { status: 500 })
  }
}

async function parseJsonMeta(req: Request): Promise<
  | { ok: true; file: Buffer; data: { year: number; month: number; strict: boolean; headerMapping?: Record<string, string> } }
  | { ok: false; message: string }
> {
  const body = await req.json() as {
    fileBase64?: string
    year?: unknown
    month?: unknown
    strict?: unknown
    headerMapping?: Record<string, string>
  }
  if (!body?.fileBase64) {
    return { ok: false, message: 'fileBase64 missing' }
  }

  const parse = metaSchema.safeParse({ year: body.year, month: body.month, strict: body.strict, headerMapping: body.headerMapping })
  if (!parse.success) {
    return { ok: false, message: 'year/month ไม่ถูกต้อง' }
  }

  return { ok: true, file: Buffer.from(body.fileBase64, 'base64'), data: parse.data }
}

async function parseFormMeta(req: Request): Promise<
  | { ok: true; file: Buffer; data: { year: number; month: number; strict: boolean; headerMapping?: Record<string, string> } }
  | { ok: false; message: string }
> {
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof Blob)) {
    return { ok: false, message: 'กรุณาแนบไฟล์ Excel' }
  }

  let headerMapping: Record<string, string> | undefined
  const mappingRaw = form.get('headerMapping')
  if (typeof mappingRaw === 'string' && mappingRaw.trim()) {
    try {
      const parsed = JSON.parse(mappingRaw) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        headerMapping = Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>).filter(
            ([k, v]) => typeof k === 'string' && typeof v === 'string'
          )
        ) as Record<string, string>
      }
    } catch {
      return { ok: false, message: 'headerMapping ต้องเป็น JSON object' }
    }
  }

  const parse = metaSchema.safeParse({
    year: form.get('year'),
    month: form.get('month'),
    strict: form.get('strict'),
    headerMapping
  })
  if (!parse.success) {
    return { ok: false, message: 'year/month ไม่ถูกต้อง' }
  }

  return { ok: true, file: Buffer.from(await file.arrayBuffer()), data: parse.data }
}
