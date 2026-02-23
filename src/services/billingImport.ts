import crypto from 'crypto'
import * as XLSX from 'xlsx'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { AuthUser } from '@/lib/auth/types'
import { REQUIRED_BILLING_HEADERS, normalizeBillingHeader, toNumberFromExcel } from '@/domain/billing/excelSchema'
import { isAllowedRoomNumber } from '@/domain/room/allowedRooms'

type Ok = { ok: true; jobId: string; status: 'SUCCESS'; processed: number }
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

function getFloorIdxFromRoom(roomNumber: string): number {
  const room = String(roomNumber).trim()
  if (room.startsWith('798/')) return 1
  const prefix = Number.parseInt(room.slice(0, 2), 10)
  if (Number.isFinite(prefix) && prefix >= 32 && prefix <= 38) return prefix - 30
  return 1
}

function sha256Hex(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

function logLine(jobId: string, phase: string, msg: string) {
  console.log(`[IMPORT][jobId=${jobId}][phase=${phase}] ${msg}`)
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
      return await fail(jobId, 'INVALID_SHEET_COUNT', 'ต้องมี 8 แผ่นงาน', useJobTable)
    }

    const toImport: ImportRow[] = []
    const seenRooms = new Set<string>()

    for (let i = 0; i < wb.SheetNames.length; i++) {
      const sheet = wb.SheetNames[i] ?? ''
      const ws = wb.Sheets[sheet]
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })

      if (rows.length > 2000) return await fail(jobId, 'SHEET_TOO_LARGE', `sheet ${sheet} too large`, useJobTable)
      if (!rows.length) continue

      const headers = (rows[0] ?? []).map((v) => normalizeBillingHeader(v))
      const headerIndex = buildHeaderIndex(headers, headerMapping)
      const headerIndexLower: Record<string, number> = {}
      for (const [k, v] of Object.entries(headerIndex)) {
        headerIndexLower[k.toLowerCase()] = v
      }

      if (strict) {
        const mismatch: Array<{ idx: number; expected: string; actual: string }> = []
        for (let j = 0; j < REQUIRED_BILLING_HEADERS.length; j++) {
          const expected = REQUIRED_BILLING_HEADERS[j] ?? ''
          const idx = headerIndex[expected]
          if (!Number.isInteger(idx)) mismatch.push({ idx: j, expected, actual: '' })
        }
        if (mismatch.length > 0) {
          return await fail(jobId, 'HEADER_MISMATCH', JSON.stringify({ sheet, mismatch }), useJobTable)
        }
      }

      const floorNo = Number.parseInt(String(sheet).replace(/\D+/g, ''), 10) || i + 1

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r] ?? []
        const raw = getRowRawBySchema(row, headerIndex)

        const roomHeader = REQUIRED_BILLING_HEADERS[1] ?? ''
        const rentHeader = REQUIRED_BILLING_HEADERS[5] ?? ''
        const waterTotalHeader = REQUIRED_BILLING_HEADERS[11] ?? ''
        const electricTotalHeader = REQUIRED_BILLING_HEADERS[17] ?? ''
        const furnitureHeader = REQUIRED_BILLING_HEADERS[18] ?? ''
        const otherHeader = REQUIRED_BILLING_HEADERS[19] ?? ''
        const grandHeader = REQUIRED_BILLING_HEADERS[20] ?? ''

        const roomRaw = getRowValue(row, headerIndex, roomHeader, []) ??
          getRowValue(row, headerIndexLower, roomHeader.toLowerCase(), ['room', 'room number', 'roomnumber'])
        const roomNumber = String(roomRaw ?? '').trim()
        if (!roomNumber) continue
        if (!isAllowedRoomNumber(roomNumber)) {
          return await fail(jobId, 'ROOM_NOT_ALLOWED', `sheet ${sheet} row ${r + 1} room ${roomNumber}`, useJobTable)
        }

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

        if (strict && Number.isFinite(grand)) {
          const expected = (rent || 0) + (water || 0) + (electric || 0) + (otherSum || 0)
          if (Math.abs(grand - expected) > 0.01) {
            return await fail(jobId, 'FORMULA_GRAND_TOTAL', `sheet ${sheet} row ${r + 1}`, useJobTable)
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

      logLine(jobId, `sheet-${i + 1}`, 'validated')
    }

    const processed = await prisma.$transaction(async (tx) => {
      const bm = await tx.billingMonth.upsert({ where: { year_month: { year, month } }, update: {}, create: { year, month } })

      if (strict) {
        const existingMatches = await tx.paymentMatch.findMany({
          where: { billingRecord: { billingMonthId: bm.id } },
          select: { id: true, paymentId: true }
        })
        const affectedPaymentIds = Array.from(new Set(existingMatches.map((m) => m.paymentId)))
        if (existingMatches.length > 0) {
          await tx.paymentMatch.deleteMany({ where: { id: { in: existingMatches.map((m) => m.id) } } })
        }
        if (affectedPaymentIds.length > 0) {
          await tx.payment.updateMany({
            where: { id: { in: affectedPaymentIds } },
            data: { matched: false, roomId: null, matchedBillingVersionId: null }
          })
        }
        await tx.documentVersion.deleteMany({ where: { billingMonthId: bm.id } })
        await tx.financialFlag.deleteMany({ where: { billingMonthId: bm.id } })
        await tx.billingVersion.deleteMany({ where: { billingMonthId: bm.id } })
        await tx.billingRecord.deleteMany({ where: { billingMonthId: bm.id } })
      }

      const uniqueRooms = Array.from(new Set(toImport.map((i) => i.roomNumber)))
      const existingRooms = await tx.room.findMany({
        where: { number: { in: uniqueRooms } },
        select: { id: true, number: true }
      })
      const roomsMap = new Map(existingRooms.map((r) => [r.number, r] as const))
      const missingRooms = uniqueRooms.filter((r) => !roomsMap.has(r))
      if (missingRooms.length > 0) {
        const needFloors = Array.from(new Set(missingRooms.map(getFloorIdxFromRoom)))
        for (const idx of needFloors) {
          await tx.floor.upsert({
            where: { idx },
            update: {},
            create: { idx, name: `ชั้น ${idx}` }
          })
        }

        const floorMap = new Map(
          (await tx.floor.findMany({
            where: { idx: { in: needFloors } },
            select: { id: true, idx: true }
          })).map((f) => [f.idx, f.id] as const)
        )

        for (const roomNumber of missingRooms) {
          const floorIdx = getFloorIdxFromRoom(roomNumber)
          const floorId = floorMap.get(floorIdx)
          if (!floorId) {
            throw new Error(`ROOM_FLOOR_NOT_FOUND:${roomNumber}`)
          }
          const room = await tx.room.create({
            data: {
              number: roomNumber,
              floorId,
              status: 'VACANT',
              type: 'NORMAL'
            },
            select: { id: true, number: true }
          })
          roomsMap.set(room.number, room)
        }
      }

      let count = 0
      for (const item of toImport) {
        const room = roomsMap.get(item.roomNumber)
        if (!room) continue

        const computedAmount = (item.fields.rent || 0) + (item.fields.water || 0) + (item.fields.electric || 0) + (item.fields.other || 0)
        const raw = JSON.parse(JSON.stringify(item.fields.raw)) as Prisma.InputJsonValue

        await tx.billingRecord.upsert({
          where: { roomNumber_billingMonthId: { roomNumber: room.number, billingMonthId: bm.id } },
          update: {
            rent: item.fields.rent,
            water: item.fields.water,
            electric: item.fields.electric,
            other: item.fields.other,
            amount: computedAmount,
            adjustments: 0,
            raw
          },
          create: {
            roomNumber: room.number,
            billingMonthId: bm.id,
            rent: item.fields.rent,
            water: item.fields.water,
            electric: item.fields.electric,
            other: item.fields.other,
            amount: computedAmount,
            adjustments: 0,
            raw
          }
        })

        if (!strict) {
          await tx.billingVersion.updateMany({
            where: { roomNumber: room.number, billingMonthId: bm.id, isActive: true },
            data: { isActive: false }
          })
        }

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

    logLine(jobId, 'done', `processed=${processed}`)
    return { ok: true, jobId, status: 'SUCCESS', processed }
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
    return { ok: false, code: 'IMPORT_FAILED', message }
  }
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
