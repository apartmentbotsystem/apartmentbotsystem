import crypto from 'crypto'
import * as XLSX from 'xlsx'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { AuthUser } from '@/lib/auth/types'
import { REQUIRED_BILLING_HEADERS, normalizeBillingHeader, toNumberFromExcel } from '@/domain/billing/excelSchema'
import { logInfo } from '@/infrastructure/logger'

type Ok = { ok: true; jobId: string; status: 'SUCCESS'; processed: number; warnings: string[] }
type Err = { ok: false; code: string; message: string }

type ImportRow = {
  floorNo: number
  roomNumber: string
  fields: {
    rent: number
    water: number
    electric: number
    other: number
    amount: number
    raw: Record<string, unknown>
  }
}

function normalizeRoomKey(input: unknown): string {
  return String(input ?? '').replace(/\u00A0/g, ' ').trim().replace(/\s+/g, '').toUpperCase()
}

export type PreviewResponse = {
  success: true
  month: string
  totalRooms: number
  warnings: string[]
  errors: []
  anomalySummary: {
    waterSpikes: Array<{ room: string; current: number; previous: number; ratio: number }>
    electricSpikes: Array<{ room: string; current: number; previous: number; ratio: number }>
    zeroUsage: string[]
    totalSpikes: Array<{ room: string; current: number; previous: number; ratio: number }>
  }
} | { success: false; errors: string[] }

function sha256Hex(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

async function logLine(jobId: string, phase: string, msg: string) {
  logInfo('billing.import', { jobId, phase, msg })
}

const TH_TH_MONTHS: Record<string, number> = {
  'ม.ค.': 1, 'ม.ค': 1, 'มกราคม': 1,
  'ก.พ.': 2, 'ก.พ': 2, 'กุมภาพันธ์': 2,
  'มี.ค.': 3, 'มี.ค': 3, 'มีนาคม': 3,
  'เม.ย.': 4, 'เม.ย': 4, 'เมษายน': 4,
  'พ.ค.': 5, 'พ.ค': 5, 'พฤษภาคม': 5,
  'มิ.ย.': 6, 'มิ.ย': 6, 'มิถุนายน': 6,
  'ก.ค.': 7, 'ก.ค': 7, 'กรกฎาคม': 7,
  'ส.ค.': 8, 'ส.ค': 8, 'สิงหาคม': 8,
  'ก.ย.': 9, 'ก.ย': 9, 'กันยายน': 9,
  'ต.ค.': 10, 'ต.ค': 10, 'ตุลาคม': 10,
  'พ.ย.': 11, 'พ.ย': 11, 'พฤศจิกายน': 11,
  'ธ.ค.': 12, 'ธ.ค': 12, 'ธันวาคม': 12
}

const EN_MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12
}

function parseMonthName(raw: unknown): number | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  const norm = s.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ')
  const lower = norm.toLowerCase()
  const thKey = Object.keys(TH_TH_MONTHS).find((k) => norm.includes(k))
  const enKey = Object.keys(EN_MONTHS).find((k) => lower.includes(k))
  if (thKey) return TH_TH_MONTHS[thKey] ?? null
  if (enKey) return EN_MONTHS[enKey] ?? null
  return null
}

function parseYearMonthFromCell(raw: unknown): { year: number; month: number } | null {
  if (raw == null) return null
  if (raw instanceof Date && Number.isFinite(raw.getTime())) {
    return { year: raw.getFullYear(), month: raw.getMonth() + 1 }
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    try {
      const parsed = (XLSX as typeof import('xlsx')).SSF.parse_date_code(raw)
      if (parsed && typeof parsed.y === 'number' && typeof parsed.m === 'number') {
        const y = parsed.y
        const m = parsed.m
        if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12) return { year: y, month: m }
      }
    } catch {
      // ignore numeric that are not excel date serials
    }
  }
  const s = String(raw).trim()
  if (!s) return null
  const thDigits: Record<string, string> = { '๐': '0', '๑': '1', '๒': '2', '๓': '3', '๔': '4', '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9' }
  const norm = s.replace(/[๐-๙]/g, (d) => thDigits[d] ?? d).replace(/\u00A0/g, ' ').replace(/\s+/g, ' ')
  const ym = norm.match(/(20\d{2}|24\d{2}|25\d{2})[-\/\s]?(\d{1,2})/)
  if (ym) {
    let y = Number(ym[1])
    const m = Number(ym[2])
    if (y >= 2400) y = y - 543
    if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12) return { year: y, month: m }
  }
  const lower = norm.toLowerCase()
  const thKey = Object.keys(TH_TH_MONTHS).find((k) => norm.includes(k))
  const enKey = Object.keys(EN_MONTHS).find((k) => lower.includes(k))
  let mName: number | null = null
  if (thKey) mName = TH_TH_MONTHS[thKey] ?? null
  else if (enKey) mName = EN_MONTHS[enKey] ?? null
  if (mName) {
    const yMatch = norm.match(/(20\d{2}|24\d{2}|25\d{2})/)
    if (yMatch) {
      let y = Number(yMatch[1])
      if (y >= 2400) y = y - 543
      if (y >= 2000 && y <= 2100) return { year: y, month: mName }
    }
  }
  return null
}

async function ensureJobsTable(): Promise<boolean> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "BillingImportJob" (
        id TEXT PRIMARY KEY,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        checksum TEXT NOT NULL,
        status TEXT NOT NULL,
        processed INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        "createdAt" TEXT NOT NULL,
        "completedAt" TEXT
      );
    `)
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "BillingImportJob_unique" ON "BillingImportJob"(year, month, checksum);
    `)
    return true
  } catch {
    return false
  }
}

function buildHeaderIndex(headers: string[], headerMapping?: Record<string, string>): Record<string, number> {
  const map: Record<string, number> = {}
  for (let i = 0; i < headers.length; i++) {
    const normalized = normalizeBillingHeader(headers[i])
    if (!normalized) continue
    map[normalized] = i
  }
  if (headerMapping && typeof headerMapping === 'object') {
    for (const [targetHeaderRaw, sourceHeaderRaw] of Object.entries(headerMapping)) {
      const targetHeader = normalizeBillingHeader(targetHeaderRaw)
      const sourceHeader = normalizeBillingHeader(sourceHeaderRaw)
      if (!targetHeader || !sourceHeader) continue
      const idx = map[sourceHeader]
      if (Number.isInteger(idx)) {
        map[targetHeader] = idx
      }
    }
  }
  return map
}

function getRowRawBySchema(row: unknown[], headerIndex: Record<string, number>): Record<string, unknown> {
  const raw: Record<string, unknown> = {}
  for (const header of REQUIRED_BILLING_HEADERS) {
    const idx = headerIndex[header]
    raw[header] = Number.isInteger(idx) ? row[idx] : undefined
  }
  return raw
}

function getRowValue(
  row: unknown[],
  headerIndex: Record<string, number>,
  primary: string,
  aliases: string[]
): unknown {
  const keys = [primary, ...aliases]
  for (const key of keys) {
    const idx = headerIndex[key]
    if (Number.isInteger(idx)) return row[idx]
  }
  return undefined
}

const HEADER_ALIASES: Record<string, string[]> = {
  'เดือน': ['month'],
  'ห้อง': ['room', 'room number', 'roomnumber'],
  'ชื่อบัญชี': ['account name', 'name'],
  'ธนาคาร': ['bank'],
  'หมายเลขบัญชี': ['account no', 'account number', 'account'],
  'ค่าเช่า': ['rent'],
  'น้ำก่อน': ['water before'],
  'น้ำหลัง': ['water after'],
  'ใช้น้ำ': ['water used'],
  'ค่าน้ำต่อหน่วย': ['water rate'],
  'ค่าบริการมิเตอร์น้ำ': ['water meter fee'],
  'รวมค่าน้ำ': ['water', 'water total'],
  'ไฟก่อน': ['electric before'],
  'ไฟหลัง': ['electric after'],
  'ใช้ไฟ': ['electric used'],
  'ค่าไฟต่อหน่วย': ['electric rate'],
  'ค่าบริการมิเตอร์ไฟ': ['electric meter fee'],
  'รวมค่าไฟ': ['electric', 'electric total'],
  'เฟอร์': ['furniture'],
  'อื่นๆ': ['other'],
  'รวมเงิน': ['amount', 'total', 'grand total'],
  'หมายเหตุ': ['note', 'remark']
}

function findLikelyHeaderRow(rows: unknown[][]): { headers: string[]; rowIndex: number } {
  const expected = new Set<string>(REQUIRED_BILLING_HEADERS.map((h) => normalizeBillingHeader(h).toLowerCase()))
  const aliasSet = new Set<string>()
  for (const aliases of Object.values(HEADER_ALIASES)) {
    for (const a of aliases) aliasSet.add(a.toLowerCase())
  }
  let bestIdx = 0
  let bestScore = -1
  const limit = Math.min(rows.length, 12)
  for (let i = 0; i < limit; i++) {
    const row = rows[i] ?? []
    let score = 0
    for (const cell of row) {
      const h = normalizeBillingHeader(cell).toLowerCase()
      if (!h) continue
      if (expected.has(h) || aliasSet.has(h)) score++
    }
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  }
  const headers = (rows[bestIdx] ?? []).map((v) => normalizeBillingHeader(v))
  return { headers, rowIndex: bestIdx }
}

function ymKey(y: number, m: number): string { return `${y}-${String(m).padStart(2, '0')}` }

export async function parsePreview(
  user: AuthUser,
  params: { year: number; month: number; fileBuf: Buffer; strict?: boolean; headerMapping?: Record<string, string> }
): Promise<PreviewResponse> {
  try {
    const { year, month, fileBuf, strict, headerMapping } = params
    const wb = await Promise.race([
      Promise.resolve().then(() => XLSX.read(fileBuf, { type: 'buffer', cellFormula: false, cellHTML: false, cellNF: false, cellText: false })),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('IMPORT_TIMEOUT')), 30000))
    ])
    const toImport: ImportRow[] = []
    const seenRooms = new Set<string>()
    const monthsFound = new Set<string>()
    const expectedYm = `${year}-${String(month).padStart(2, '0')}`
    const warnings: string[] = []

    for (let i = 0; i < wb.SheetNames.length; i++) {
      const sheet = wb.SheetNames[i] ?? ''
      const ws = wb.Sheets[sheet]
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })
      if (!rows.length) continue
      const hdr = findLikelyHeaderRow(rows)
      const headers = hdr.headers
      const headerIndex = buildHeaderIndex(headers, headerMapping)
      const headerIndexLower: Record<string, number> = {}
      for (const [k, v] of Object.entries(headerIndex)) headerIndexLower[k.toLowerCase()] = v

      const monthHeader = REQUIRED_BILLING_HEADERS[0] ?? 'เดือน'
      const roomHeader = REQUIRED_BILLING_HEADERS[1] ?? 'ห้อง'
      const rentHeader = REQUIRED_BILLING_HEADERS[5] ?? 'ค่าเช่า'
      const waterTotalHeader = REQUIRED_BILLING_HEADERS[11] ?? 'รวมค่าน้ำ'
      const electricTotalHeader = REQUIRED_BILLING_HEADERS[17] ?? 'รวมค่าไฟ'
      const furnitureHeader = REQUIRED_BILLING_HEADERS[18] ?? 'เฟอร์'
      const otherHeader = REQUIRED_BILLING_HEADERS[19] ?? 'อื่นๆ'
      const grandHeader = REQUIRED_BILLING_HEADERS[20] ?? 'รวมเงิน'

      for (let r = hdr.rowIndex + 1; r < rows.length; r++) {
        const row = rows[r] ?? []
        try {
          const mval =
            getRowValue(row, headerIndex, monthHeader, []) ??
            getRowValue(row, headerIndexLower, monthHeader.toLowerCase(), ['เดือน', 'month'])
          const ymParsed = parseYearMonthFromCell(mval)
          if (ymParsed) {
            monthsFound.add(ymKey(ymParsed.year, ymParsed.month))
          }
        } catch { /* ignore */ }

        const roomRaw = getRowValue(row, headerIndex, roomHeader, []) ??
          getRowValue(row, headerIndexLower, roomHeader.toLowerCase(), ['room', 'room number', 'roomnumber'])
        const roomNumber = normalizeRoomKey(roomRaw)
        if (!roomNumber) continue
        // Room number is free-form; existence is validated during import apply phase
        if (strict && seenRooms.has(roomNumber)) {
          return { success: false, errors: [`DUPLICATE_ROOM:${roomNumber}`] }
        }
        const rent = toNumberFromExcel(
          getRowValue(row, headerIndex, rentHeader, []) ??
          getRowValue(row, headerIndexLower, rentHeader.toLowerCase(), ['rent', 'amount'])
        )
        const water = toNumberFromExcel(
          getRowValue(row, headerIndex, waterTotalHeader, []) ??
          getRowValue(row, headerIndexLower, waterTotalHeader.toLowerCase(), ['water', 'water total'])
        )
        const electric = toNumberFromExcel(
          getRowValue(row, headerIndex, electricTotalHeader, []) ??
          getRowValue(row, headerIndexLower, electricTotalHeader.toLowerCase(), ['electric', 'electric total'])
        )
        const furniture = toNumberFromExcel(
          getRowValue(row, headerIndex, furnitureHeader, []) ??
          getRowValue(row, headerIndexLower, furnitureHeader.toLowerCase(), ['furniture'])
        )
        const other = toNumberFromExcel(
          getRowValue(row, headerIndex, otherHeader, []) ??
          getRowValue(row, headerIndexLower, otherHeader.toLowerCase(), ['other'])
        )
        const otherSum = (furniture || 0) + (other || 0)
        const grand = toNumberFromExcel(
          getRowValue(row, headerIndex, grandHeader, []) ??
          getRowValue(row, headerIndexLower, grandHeader.toLowerCase(), ['amount', 'total', 'grand total'])
        )
        const nums = [
          { v: rent, name: 'rent' },
          { v: water, name: 'water' },
          { v: electric, name: 'electric' },
          { v: furniture, name: 'furniture' },
          { v: other, name: 'other' },
          { v: grand, name: 'amount' }
        ]
        for (const n of nums) {
          if (!Number.isFinite(n.v)) return { success: false, errors: [`INVALID_NUMBER:${n.name}`] }
          if ((n.v as number) < 0) return { success: false, errors: [`NEGATIVE_NUMBER:${n.name}`] }
        }
        if (Number.isFinite(grand)) {
          const expected = (rent || 0) + (water || 0) + (electric || 0) + (otherSum || 0)
          const diff = Math.abs((grand || 0) - expected)
          if (diff > 1) warnings.push(`total diff=${diff.toFixed(2)} room=${roomNumber}`)
        }
        toImport.push({
          floorNo: i + 1,
          roomNumber,
          fields: {
            rent: rent || 0,
            water: water || 0,
            electric: electric || 0,
            other: otherSum || 0,
            amount: grand || 0,
            raw: {}
          }
        })
        seenRooms.add(roomNumber)
      }
    }
    if (monthsFound.size && !monthsFound.has(expectedYm)) {
      return { success: false, errors: [`MONTH_MISMATCH:${expectedYm}`] }
    }
    // anomalies by comparing to previous month totals
    const prevYear = month === 1 ? year - 1 : year
    const prevMonth = month === 1 ? 12 : (month - 1)
    const prevBm = await prisma.billingMonth.findUnique({ where: { year_month: { year: prevYear, month: prevMonth } }, select: { id: true } })
    const prevMap = new Map<string, { water: number; electric: number; amount: number }>()
    if (prevBm) {
      const recs = await prisma.billingRecord.findMany({ where: { billingMonthId: prevBm.id }, select: { roomNumber: true, water: true, electric: true, amount: true } })
      for (const r of recs) prevMap.set(r.roomNumber, { water: Number(r.water), electric: Number(r.electric), amount: Number(r.amount) })
    }
    const waterSpikes: Array<{ room: string; current: number; previous: number; ratio: number }> = []
    const electricSpikes: Array<{ room: string; current: number; previous: number; ratio: number }> = []
    const totalSpikes: Array<{ room: string; current: number; previous: number; ratio: number }> = []
    const zeroUsage: string[] = []
    const { waterSpikeRatio, electricSpikeRatio, totalSpikeRatio } = (await import('@/config/system')).getSpikeThresholds()
    for (const item of toImport) {
      const prev = prevMap.get(item.roomNumber)
      if (!prev) continue
      const wr = prev.water > 0 ? (item.fields.water / prev.water) : (item.fields.water > 0 ? Infinity : 1)
      const er = prev.electric > 0 ? (item.fields.electric / prev.electric) : (item.fields.electric > 0 ? Infinity : 1)
      const tr = prev.amount > 0 ? (item.fields.amount / prev.amount) : (item.fields.amount > 0 ? Infinity : 1)
      if (wr > waterSpikeRatio) waterSpikes.push({ room: item.roomNumber, current: item.fields.water, previous: prev.water, ratio: wr })
      if (er > electricSpikeRatio) electricSpikes.push({ room: item.roomNumber, current: item.fields.electric, previous: prev.electric, ratio: er })
      if (tr > totalSpikeRatio) totalSpikes.push({ room: item.roomNumber, current: item.fields.amount, previous: prev.amount, ratio: tr })
      if ((item.fields.water === 0 && prev.water > 0) || (item.fields.electric === 0 && prev.electric > 0)) zeroUsage.push(item.roomNumber)
    }
    return { success: true, month: expectedYm, totalRooms: toImport.length, warnings, errors: [], anomalySummary: { waterSpikes, electricSpikes, zeroUsage, totalSpikes } }
  } catch (e) {
    return { success: false, errors: [String(e)] }
  }
}

export async function runImport(
  user: AuthUser,
  params: { year: number; month: number; fileBuf: Buffer; strict?: boolean; headerMapping?: Record<string, string> }
): Promise<Ok | Err> {
  const { year, month, fileBuf, strict, headerMapping } = params
  const useJobTable = await ensureJobsTable()
  const checksum = sha256Hex(fileBuf)

  let jobId: string = crypto.randomUUID()
  if (useJobTable) {
    try {
      const existingRows = await prisma.$queryRaw<Array<{ id: string; status: string; processed?: number; createdAt?: string; createdat?: string; created_at?: string }>>`
        SELECT * FROM "BillingImportJob" WHERE year = ${year} AND month = ${month} AND checksum = ${checksum} LIMIT 1
      `
      const existing = existingRows.map((r) => ({
        id: r.id,
        status: r.status,
        processed: typeof r.processed === 'number' ? r.processed : 0,
        createdAt: (r.createdAt ?? r.createdat ?? r.created_at ?? '')
      }))
      if (existing.length) {
        const st = existing[0]!.status
        if (st === 'SUCCESS') {
          jobId = existing[0]!.id
          await prisma.$executeRaw`
            UPDATE "BillingImportJob"
            SET status = 'PROCESSING', error = NULL, processed = 0
            WHERE id = ${jobId}
          `
        }
        if (st === 'PROCESSING') {
          const createdAt = new Date(existing[0]!.createdAt).getTime()
          const ageSec = (Date.now() - createdAt) / 1000
          if (Number.isFinite(ageSec) && ageSec > 60) {
            jobId = existing[0]!.id
            await prisma.$executeRaw`
              UPDATE "BillingImportJob"
              SET status = 'PROCESSING', error = NULL, processed = 0
              WHERE id = ${jobId}
            `
          } else {
            return { ok: false, code: 'IMPORT_EXISTS_PROCESSING', message: 'Duplicate import job' }
          }
        } else if (st !== 'SUCCESS') {
          jobId = existing[0]!.id
          await prisma.$executeRaw`
            UPDATE "BillingImportJob"
            SET status = 'PROCESSING', error = NULL, processed = 0
            WHERE id = ${jobId}
          `
        }
      } else {
        jobId = crypto.randomUUID()
        await prisma.$executeRawUnsafe(`
          INSERT INTO "BillingImportJob"(id, year, month, checksum, status, "createdAt")
          VALUES ('${jobId}', ${year}, ${month}, '${checksum}', 'PENDING', NOW())
        `)
        await prisma.$executeRaw`
          UPDATE "BillingImportJob" SET status = 'PROCESSING' WHERE id = ${jobId}
        `
      }
    } catch {
      jobId = crypto.randomUUID()
    }
  } else {
    jobId = crypto.randomUUID()
  }

  logLine(jobId, 'start', `year=${year} month=${month}`)

  try {
    const wb = await Promise.race([
      Promise.resolve().then(() => XLSX.read(fileBuf, { type: 'buffer', cellFormula: false, cellHTML: false, cellNF: false, cellText: false })),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('IMPORT_TIMEOUT')), 30000))
    ])

    logLine(jobId, 'workbook', 'parsed')

    if (strict && wb.SheetNames.length !== 8) {
      return await fail(jobId, 'INVALID_SHEET_COUNT', `ต้องมี 8 แผ่นงาน (พบ ${wb.SheetNames.length})`, useJobTable)
    }

    const toImport: ImportRow[] = []
    const seenRooms = new Set<string>()
    const monthsFound = new Set<string>()
    const expectedYm = `${year}-${String(month).padStart(2, '0')}`
    const warnings: string[] = []

    for (let i = 0; i < wb.SheetNames.length; i++) {
      const sheet = wb.SheetNames[i] ?? ''
      const ws = wb.Sheets[sheet]
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })

      if (rows.length > 2000) return await fail(jobId, 'SHEET_TOO_LARGE', `sheet ${sheet} too large`, useJobTable)
      if (!rows.length) continue

      const hdr = findLikelyHeaderRow(rows)
      const headers = hdr.headers
      const headerIndex = buildHeaderIndex(headers, headerMapping)
      const headerIndexLower: Record<string, number> = {}
      for (const [k, v] of Object.entries(headerIndex)) {
        headerIndexLower[k.toLowerCase()] = v
      }

      if (strict) {
        const monthHeader = REQUIRED_BILLING_HEADERS[0] ?? 'เดือน'
        const roomHeader = REQUIRED_BILLING_HEADERS[1] ?? 'ห้อง'
        const hasMonth =
          Number.isInteger(headerIndex[monthHeader]) ||
          Number.isInteger(headerIndexLower[monthHeader.toLowerCase()])
        const hasRoom =
          Number.isInteger(headerIndex[roomHeader]) ||
          Number.isInteger(headerIndexLower[roomHeader.toLowerCase()])
        const grandHeader = REQUIRED_BILLING_HEADERS[20] ?? 'รวมเงิน'
        const rentHeader = REQUIRED_BILLING_HEADERS[5] ?? 'ค่าเช่า'
        const waterTotalHeader = REQUIRED_BILLING_HEADERS[11] ?? 'รวมค่าน้ำ'
        const electricTotalHeader = REQUIRED_BILLING_HEADERS[17] ?? 'รวมค่าไฟ'
        const furnitureHeader = REQUIRED_BILLING_HEADERS[18] ?? 'เฟอร์'
        const otherHeader = REQUIRED_BILLING_HEADERS[19] ?? 'อื่นๆ'
        const hasGrand =
          Number.isInteger(headerIndex[grandHeader]) ||
          Number.isInteger(headerIndexLower[grandHeader.toLowerCase()])
        const hasAnyComponent =
          Number.isInteger(headerIndex[rentHeader]) || Number.isInteger(headerIndexLower[rentHeader.toLowerCase()]) ||
          Number.isInteger(headerIndex[waterTotalHeader]) || Number.isInteger(headerIndexLower[waterTotalHeader.toLowerCase()]) ||
          Number.isInteger(headerIndex[electricTotalHeader]) || Number.isInteger(headerIndexLower[electricTotalHeader.toLowerCase()]) ||
          Number.isInteger(headerIndex[furnitureHeader]) || Number.isInteger(headerIndexLower[furnitureHeader.toLowerCase()]) ||
          Number.isInteger(headerIndex[otherHeader]) || Number.isInteger(headerIndexLower[otherHeader.toLowerCase()])
        if (!hasMonth || !hasRoom || (!hasGrand && !hasAnyComponent)) {
          const mismatch = []
          if (!hasMonth) mismatch.push({ expected: monthHeader })
          if (!hasRoom) mismatch.push({ expected: roomHeader })
          if (!hasGrand && !hasAnyComponent) mismatch.push({ expected: `${grandHeader}|components` })
          return await fail(jobId, 'HEADER_MISMATCH', JSON.stringify({ sheet, mismatch }), useJobTable)
        }
      }

      const floorNo = Number.parseInt(String(sheet).replace(/\D+/g, ''), 10) || i + 1

      // Pre-scan month from the first few rows in the month column (in case values are not per-row)
      try {
        const monthHeader = REQUIRED_BILLING_HEADERS[0] ?? 'เดือน'
        const mIdx =
          (headerIndex[monthHeader] ?? undefined) ??
          (headerIndexLower[monthHeader.toLowerCase()] ?? undefined)
        if (Number.isInteger(mIdx)) {
          const start = Math.max(hdr.rowIndex, 0)
          const end = Math.min(rows.length, start + 10)
          for (let t = start; t < end; t++) {
            const cell = (rows[t] ?? [])[mIdx as number]
            const ymParsed = parseYearMonthFromCell(cell)
            if (ymParsed) {
              const ymKey = `${ymParsed.year}-${String(ymParsed.month).padStart(2, '0')}`
              monthsFound.add(ymKey)
            } else {
              const mOnly = parseMonthName(cell)
              if (mOnly) {
                const ymKey = `${year}-${String(mOnly).padStart(2, '0')}`
                monthsFound.add(ymKey)
              }
            }
          }
        }
        // Broad scan across the top few rows for month-like text (titles/merged cells)
        const scanEnd = Math.min(rows.length, hdr.rowIndex + 3)
        for (let t = Math.max(0, hdr.rowIndex - 1); t < scanEnd; t++) {
          const row = rows[t] ?? []
          for (let c = 0; c < row.length; c++) {
            const v = row[c]
            if (typeof v === 'number') continue
            const ymParsed = parseYearMonthFromCell(v)
            if (ymParsed) {
              const ymKey = `${ymParsed.year}-${String(ymParsed.month).padStart(2, '0')}`
              monthsFound.add(ymKey)
            } else {
              const mOnly = parseMonthName(v)
              if (mOnly) {
                const ymKey = `${year}-${String(mOnly).padStart(2, '0')}`
                monthsFound.add(ymKey)
              }
            }
          }
        }
      } catch {
        // best-effort only
      }

      for (let r = hdr.rowIndex + 1; r < rows.length; r++) {
        const row = rows[r] ?? []
        const raw = getRowRawBySchema(row, headerIndex)

        try {
          const monthHeader = REQUIRED_BILLING_HEADERS[0] ?? 'เดือน'
          const mval =
            getRowValue(row, headerIndex, monthHeader, []) ??
            getRowValue(row, headerIndexLower, monthHeader.toLowerCase(), ['เดือน', 'month'])
          const ymParsed = parseYearMonthFromCell(mval)
          if (ymParsed) {
            const ymKey = `${ymParsed.year}-${String(ymParsed.month).padStart(2, '0')}`
            monthsFound.add(ymKey)
          } else {
            const mOnly = parseMonthName(mval)
            if (mOnly) {
              const ymKey = `${year}-${String(mOnly).padStart(2, '0')}`
              monthsFound.add(ymKey)
            }
          }
        } catch {
          // ignore per-row month parse errors
        }

        const roomHeader = REQUIRED_BILLING_HEADERS[1] ?? ''
        const rentHeader = REQUIRED_BILLING_HEADERS[5] ?? ''
        const waterTotalHeader = REQUIRED_BILLING_HEADERS[11] ?? ''
        const electricTotalHeader = REQUIRED_BILLING_HEADERS[17] ?? ''
        const furnitureHeader = REQUIRED_BILLING_HEADERS[18] ?? ''
        const otherHeader = REQUIRED_BILLING_HEADERS[19] ?? ''
        const grandHeader = REQUIRED_BILLING_HEADERS[20] ?? ''

        const roomRaw = getRowValue(row, headerIndex, roomHeader, []) ??
          getRowValue(row, headerIndexLower, roomHeader.toLowerCase(), ['room', 'room number', 'roomnumber'])
        const roomNumber = normalizeRoomKey(roomRaw)
        if (!roomNumber) continue
        // Accept any non-empty room number; validity checked during application/update

        if (strict && seenRooms.has(roomNumber)) {
          return await fail(jobId, 'DUPLICATE_ROOM', `sheet ${sheet} row ${r + 1} room ${roomNumber}`, useJobTable)
        }

        const rent = toNumberFromExcel(
          getRowValue(row, headerIndex, rentHeader, []) ??
          getRowValue(row, headerIndexLower, rentHeader.toLowerCase(), ['rent', 'amount'])
        )
        const water = toNumberFromExcel(
          getRowValue(row, headerIndex, waterTotalHeader, []) ??
          getRowValue(row, headerIndexLower, waterTotalHeader.toLowerCase(), ['water', 'water total'])
        )
        const electric = toNumberFromExcel(
          getRowValue(row, headerIndex, electricTotalHeader, []) ??
          getRowValue(row, headerIndexLower, electricTotalHeader.toLowerCase(), ['electric', 'electric total'])
        )
        const furniture = toNumberFromExcel(
          getRowValue(row, headerIndex, furnitureHeader, []) ??
          getRowValue(row, headerIndexLower, furnitureHeader.toLowerCase(), ['furniture'])
        )
        const other = toNumberFromExcel(
          getRowValue(row, headerIndex, otherHeader, []) ??
          getRowValue(row, headerIndexLower, otherHeader.toLowerCase(), ['other'])
        )
        const otherSum = (furniture || 0) + (other || 0)
        const grand = toNumberFromExcel(
          getRowValue(row, headerIndex, grandHeader, []) ??
          getRowValue(row, headerIndexLower, grandHeader.toLowerCase(), ['amount', 'total', 'grand total'])
        )

        const nums = [
          { v: rent, name: 'rent' },
          { v: water, name: 'water' },
          { v: electric, name: 'electric' },
          { v: furniture, name: 'furniture' },
          { v: other, name: 'other' },
          { v: grand, name: 'amount' }
        ]
        for (const n of nums) {
          if (!Number.isFinite(n.v)) {
            return await fail(jobId, 'INVALID_NUMBER', `sheet ${sheet} row ${r + 1} field ${n.name} NaN`, useJobTable)
          }
          if ((n.v as number) < 0) {
            return await fail(jobId, 'NEGATIVE_NUMBER', `sheet ${sheet} row ${r + 1} field ${n.name} negative`, useJobTable)
          }
        }

        if (Number.isFinite(grand)) {
          const expected = (rent || 0) + (water || 0) + (electric || 0) + (otherSum || 0)
          const diff = Math.abs((grand || 0) - expected)
          if (diff > 1) {
            const msg = `sheet ${sheet} row ${r + 1} total diff=${diff.toFixed(2)}`
            if (strict) {
              return await fail(jobId, 'FORMULA_GRAND_TOTAL', msg, useJobTable)
            } else {
              warnings.push(msg)
            }
          }
        }

        toImport.push({
          floorNo,
          roomNumber,
          fields: {
            rent: rent || 0,
            water: water || 0,
            electric: electric || 0,
            other: otherSum || 0,
            amount: grand || 0,
            raw
          }
        })
        seenRooms.add(roomNumber)
      }
      // Fallback: also try derive from sheet name
      const fromSheetName = parseYearMonthFromCell(sheet)
      if (fromSheetName) {
        const ymKey = `${fromSheetName.year}-${String(fromSheetName.month).padStart(2, '0')}`
        monthsFound.add(ymKey)
      }
      logLine(jobId, `sheet-${i + 1}`, 'validated')
    }

    if (monthsFound.size === 0) {
      return await fail(jobId, 'MONTH_NOT_FOUND', 'ไม่พบค่าเดือนในไฟล์ (คอลัมน์ \"เดือน\")', useJobTable)
    } else {
      const unique = Array.from(monthsFound)
      if (unique.includes(expectedYm)) {
        // ok
      } else {
        const sample = unique.slice(0, 8)
        return await fail(
          jobId,
          'MONTH_MISMATCH',
          JSON.stringify({ expected: expectedYm, foundCount: unique.length, sample }),
          useJobTable
        )
      }
    }

    const processed = await prisma.$transaction(async (tx) => {
      const existingBm = await tx.billingMonth.findUnique({ where: { year_month: { year, month } }, select: { id: true } })
      if (existingBm) {
        throw new Error('MONTH_ALREADY_IMPORTED')
      }
      const bm = await tx.billingMonth.create({ data: { year, month } })

      // no destructive updates for existing months; this path only runs for a new month

      const uniqueRooms = Array.from(new Set(toImport.map((i) => i.roomNumber)))
      const existingRooms = await tx.room.findMany({
        where: { number: { in: uniqueRooms } },
        select: { id: true, number: true }
      })
      const byNumber = new Map<string, Array<{ id: string; number: string }>>()
      for (const r of existingRooms) {
        const arr = byNumber.get(r.number) ?? []
        arr.push(r)
        byNumber.set(r.number, arr)
      }
      const ambiguous = Array.from(byNumber.entries()).filter(([, arr]) => arr.length > 1).map(([n]) => n)
      if (ambiguous.length > 0) {
        throw new Error(`AMBIGUOUS_ROOMS:${ambiguous.slice(0, 5).join(',')}`)
      }
      const roomsMap = new Map(existingRooms.map((r) => [r.number, r] as const))
      const missingRooms = uniqueRooms.filter((r) => !roomsMap.has(r))
      if (missingRooms.length > 0) {
        throw new Error(`MISSING_ROOMS:${missingRooms.slice(0, 5).join(',')}`)
      }

      let count = 0
      for (const item of toImport) {
        const room = roomsMap.get(item.roomNumber)
        if (!room) continue

        const computedAmount = (item.fields.rent || 0) + (item.fields.water || 0) + (item.fields.electric || 0) + (item.fields.other || 0)
        const raw = JSON.parse(JSON.stringify(item.fields.raw)) as Prisma.InputJsonValue

        await tx.billingRecord.create({
          data: {
            roomNumber: room.number,
            billingMonthId: bm.id,
            rent: item.fields.rent,
            water: item.fields.water,
            electric: item.fields.electric,
            other: item.fields.other,
            amount: computedAmount,
            raw
          }
        })

        // do not deactivate previous versions for other months; this is a fresh month

        const latestNo = await tx.billingVersion.aggregate({
          where: { roomNumber: room.number, billingMonthId: bm.id },
          _max: { versionNo: true }
        })
        const nextNo = (latestNo._max.versionNo ?? 0) + 1

        await tx.billingVersion.create({
          data: {
            roomId: room.id,
            roomNumber: room.number,
            billingMonthId: bm.id,
            versionNo: nextNo,
            snapshotData: {
              roomNumber: room.number,
              billingMonthId: bm.id,
              raw,
              rent: item.fields.rent,
              water: item.fields.water,
              electric: item.fields.electric,
              other: item.fields.other,
              amount: computedAmount
            },
            totalAmount: computedAmount,
            createdBy: user.id,
            isActive: true
          }
        })

        count++
      }

      return count
    }, { timeout: 120000, maxWait: 20000 })

    if (useJobTable) {
      try {
        await prisma.$executeRawUnsafe(`UPDATE "BillingImportJob" SET status='SUCCESS', processed=${processed}, "completedAt"=NOW() WHERE id='${jobId}'`)
      } catch {
        // best effort only
      }
    }

    await prisma.auditLog.create({
      data: {
        action: 'BILLING_IMPORT_SUCCESS',
        entityType: 'BillingMonth',
        entityId: `${year}-${month}`,
        data: { actorId: user.id, year, month, recordsProcessed: processed, checksum, jobId }
      }
    })
    await prisma.auditLog.create({
      data: {
        action: 'IMPORT_BILLING_MONTH',
        entityType: 'BillingMonth',
        entityId: `${year}-${month}`,
        data: { actorId: user.id, totalRooms: processed, importedAt: new Date().toISOString() }
      }
    })

    await logLine(jobId, 'done', `processed=${processed}`)
    return { ok: true, jobId, status: 'SUCCESS', processed, warnings }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    const esc = String(message).replace(/'/g, "''")
    if (useJobTable) {
      try {
        await prisma.$executeRawUnsafe(`UPDATE "BillingImportJob" SET status='FAILED', error='${esc}', "completedAt"=NOW() WHERE id='${jobId}'`)
      } catch {
        // best effort only
      }
    }

    try {
      await prisma.auditLog.create({
        data: {
          action: 'BILLING_IMPORT_FAILED',
          entityType: 'BillingMonth',
          entityId: `${year}-${month}`,
          data: { actorId: user.id, errorMessage: message, jobId }
        }
      })
    } catch {
      // no-op
    }

    logLine(jobId, 'fail', message)
    if (String(message).startsWith('MONTH_ALREADY_IMPORTED')) {
      return { ok: false, code: 'MONTH_ALREADY_IMPORTED', message: 'Month already imported.' }
    }
    if (String(message).startsWith('FILE_ALREADY_IMPORTED')) {
      return { ok: false, code: 'FILE_ALREADY_IMPORTED', message: 'File already imported.' }
    }
    if (String(message).startsWith('MISSING_ROOMS:')) {
      return { ok: false, code: 'MISSING_ROOM', message: message }
    }
    if (String(message).startsWith('AMBIGUOUS_ROOMS:')) {
      return { ok: false, code: 'AMBIGUOUS_ROOM', message: message }
    }
    return { ok: false, code: 'IMPORT_FAILED', message }
  }
}

export async function confirmImport(
  user: AuthUser,
  params: { year: number; month: number; fileBuf: Buffer; strict?: boolean; headerMapping?: Record<string, string> }
): Promise<Ok | Err> {
  return runImport(user, params)
}

async function fail(jobId: string, code: string, message: string, useJobTable: boolean): Promise<Err> {
  const safeMsg = `${code}:${message}`.replace(/'/g, "''")
  if (useJobTable) {
    try {
      await prisma.$executeRawUnsafe(`UPDATE "BillingImportJob" SET status='FAILED', error='${safeMsg}', "completedAt"=NOW() WHERE id='${jobId}'`)
    } catch {
      // best effort only
    }
  }
  return { ok: false, code, message }
}
