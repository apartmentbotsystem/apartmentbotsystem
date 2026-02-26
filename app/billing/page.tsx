import Link from 'next/link'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { getActiveMonth, getActiveBuildingId, getActiveFloor } from '@/lib/context'
import MonthPicker from './MonthPicker'
import { REQUIRED_BILLING_HEADERS } from '@/domain/billing/excelSchema'
import { requireSession } from '@/lib/auth/require-session'
import OwnerRestorePanel from './OwnerRestorePanel'
import BillingGridClient from './BillingGridClient'
import { formatYm, getConsumptionYm } from '@/lib/datetime'
import ConfirmPostButton from '@/components/ui/ConfirmPostButton'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BillingRow = {
  id: string
  roomNumber: string
  rent: unknown
  water: unknown
  electric: unknown
  other: unknown
  amount: unknown
  note: string | null
  raw: unknown
}

function toText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }
  if (value && typeof value === 'object' && 'toNumber' in value && typeof (value as { toNumber?: unknown }).toNumber === 'function') {
    try {
      const n = Number((value as { toNumber(): number }).toNumber())
      return Number.isFinite(n) ? n : 0
    } catch {
      return 0
    }
  }
  return 0
}

function readCell(row: BillingRow, header: (typeof REQUIRED_BILLING_HEADERS)[number]): string {
  const raw = (row.raw ?? null) as Record<string, unknown> | null
  const fromRaw = raw ? raw[header] : undefined
  if (fromRaw !== undefined && fromRaw !== null && toText(fromRaw).trim() !== '') {
    return toText(fromRaw)
  }

  if (header === REQUIRED_BILLING_HEADERS[1]) return row.roomNumber
  if (header === REQUIRED_BILLING_HEADERS[5]) return asNumber(row.rent).toFixed(2)
  if (header === REQUIRED_BILLING_HEADERS[11]) return asNumber(row.water).toFixed(2)
  if (header === REQUIRED_BILLING_HEADERS[17]) return asNumber(row.electric).toFixed(2)
  if (header === REQUIRED_BILLING_HEADERS[20]) return asNumber(row.amount).toFixed(2)
  if (header === REQUIRED_BILLING_HEADERS[21]) return row.note ?? ''

  return ''
}

export default async function BillingPage({
  searchParams
}: {
  searchParams?: { floor?: string; year?: string; month?: string }
}) {
  let isOwner = false
  try {
    const h = await headers()
    const cookieHeader = h.get('cookie') ?? ''
    const user = await requireSession(new Request('http://localhost/billing', { headers: { cookie: cookieHeader } }))
    isOwner = user.role === 'OWNER'
  } catch {
    isOwner = false
  }

  const months = await prisma.billingMonth.findMany({
    select: { year: true, month: true },
    orderBy: [{ year: 'desc' }, { month: 'desc' }]
  })

  const qpYear = Number(searchParams?.year ?? '')
  const qpMonth = Number(searchParams?.month ?? '')
  const useQueryMonth = Number.isFinite(qpYear) && Number.isFinite(qpMonth) && qpYear >= 2000 && qpYear <= 2100 && qpMonth >= 1 && qpMonth <= 12
  const { year, month } = useQueryMonth ? { year: qpYear, month: qpMonth } : await getActiveMonth()
  const buildingId = await getActiveBuildingId()
  const activeFloorFromContext = await getActiveFloor()
  const floorFromQuery = Number(searchParams?.floor ?? '')
  const selectedFloor = Number.isFinite(floorFromQuery) && floorFromQuery >= 1
    ? floorFromQuery
    : (useQueryMonth ? null : activeFloorFromContext)

  const [billingMonth, floors] = await Promise.all([
    prisma.billingMonth.findFirst({
      where: { year, month },
      select: { id: true, locked: true }
    }),
    prisma.floor.findMany({ select: { idx: true, name: true }, orderBy: { idx: 'asc' } })
  ])

  const locked = billingMonth?.locked ?? false

  const buildingCount = await prisma.building.count()
  const applyBuilding = !useQueryMonth && Boolean(buildingId) && buildingCount > 1

  const baseWhere = {
    billingMonth: { year, month },
    room: {
      ...(selectedFloor ? { floor: { idx: selectedFloor } } : {})
    }
  } as const
  const baseNoFloorWhere = {
    billingMonth: { year, month }
  } as const
  const withBuildingWhere = {
    billingMonth: { year, month },
    room: {
      ...(applyBuilding ? { buildingId } : {}),
      ...(selectedFloor ? { floor: { idx: selectedFloor } } : {})
    }
  } as const
  const withBuildingNoFloorWhere = {
    billingMonth: { year, month },
    room: {
      ...(applyBuilding ? { buildingId } : {})
    }
  } as const
  let rowsRaw = await prisma.billingRecord.findMany({
    where: useQueryMonth ? baseNoFloorWhere : (applyBuilding ? withBuildingWhere : baseWhere),
    select: {
      id: true,
      roomNumber: true,
      rent: true,
      water: true,
      electric: true,
      other: true,
      amount: true,
      note: true,
      raw: true
    }
  })
  if (!useQueryMonth && applyBuilding && rowsRaw.length === 0) {
    rowsRaw = await prisma.billingRecord.findMany({
      where: baseWhere,
      select: {
        id: true,
        roomNumber: true,
        rent: true,
        water: true,
        electric: true,
        other: true,
        amount: true,
        note: true,
        raw: true
      }
    })
  }
  if (!useQueryMonth && rowsRaw.length === 0 && selectedFloor) {
    rowsRaw = await prisma.billingRecord.findMany({
      where: applyBuilding ? withBuildingNoFloorWhere : baseNoFloorWhere,
      select: {
        id: true,
        roomNumber: true,
        rent: true,
        water: true,
        electric: true,
        other: true,
        amount: true,
        note: true,
        raw: true
      }
    })
  }

  const rows = [...rowsRaw].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, 'th'))
  const versions = isOwner && billingMonth?.id
    ? await prisma.billingVersion.findMany({
        where: { billingMonthId: billingMonth.id },
        select: { id: true, roomNumber: true, versionNo: true, isActive: true, createdAt: true }
      })
    : []

  const consumptionYm = getConsumptionYm(year, month)

  const editorRows = rows.map((row) => {
    const baseRaw = (row.raw ?? {}) as Record<string, unknown>
    const raw: Record<string, string> = {}
    for (const header of REQUIRED_BILLING_HEADERS) {
      raw[header] = readCell(row as BillingRow, header)
    }
    raw[REQUIRED_BILLING_HEADERS[1]] = row.roomNumber

    return {
      id: row.id,
      roomNumber: row.roomNumber,
      raw: { ...Object.fromEntries(Object.entries(baseRaw).map(([k, v]) => [k, toText(v)])), ...raw }
    }
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold">บิล - {formatYm(year, month)}</h1>
          <div className="text-xs opacity-70">รอบใช้หน่วย: {consumptionYm} {selectedFloor ? `| ชั้น ${selectedFloor}` : '| ทุกชั้น'}</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <MonthPicker year={year} month={month} months={months} />
          <span className="chip">จำนวนห้อง: {rows.length}</span>
          <Link href="/admin/billing/upload" className="btn btn-secondary text-sm">อัปโหลด Excel</Link>
          <a href={`/api/export/billing?year=${year}&month=${month}`} className="btn btn-outline text-sm" target="_blank">Export CSV</a>
          <ConfirmPostButton
            action="/api/billing/lock"
            fields={{ year: String(year), month: String(month), locked: 'true' }}
            confirmTitle="ยืนยันการล็อกรอบบิล"
            confirmDescription="เมื่อล็อกแล้วจะไม่สามารถแก้ไขข้อมูลได้ จนกว่าจะปลดล็อก"
            destructive
          >
            ล็อกรอบบิล
          </ConfirmPostButton>
          <ConfirmPostButton
            action="/api/billing/lock"
            fields={{ year: String(year), month: String(month), locked: 'false' }}
            confirmTitle="ยืนยันการปลดล็อกรอบบิล"
            confirmDescription="การปลดล็อกเปิดให้แก้ไขข้อมูลได้อีกครั้ง"
          >
            ปลดล็อกรอบบิล
          </ConfirmPostButton>
          <Link href="/admin/documents/generate" className="px-2 py-1 border erp-border rounded text-sm">สร้างเอกสาร</Link>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap text-sm">
        <span className="opacity-70">เลือกชั้น:</span>
        <Link href="/billing" className={`px-2 py-1 border rounded ${selectedFloor ? 'erp-border' : 'bg-[var(--bg-surface)] erp-border font-medium'}`}>ทุกชั้น</Link>
        {floors
          .map((f) => (
            <Link
              key={f.idx}
              href={`/billing?floor=${f.idx}`}
              className={`px-2 py-1 border rounded ${selectedFloor === f.idx ? 'bg-[var(--bg-surface)] erp-border font-medium' : 'erp-border'}`}
            >
              ชั้น {f.idx}
            </Link>
          ))}
      </div>

      {locked && <div className="text-sm px-3 py-2 border erp-border rounded bg-red-50 text-red-700">รอบบิลถูกล็อก: อ่านอย่างเดียว</div>}

      <BillingGridClient
        year={year}
        month={month}
        locked={locked}
        initialRows={editorRows}
      />

      {isOwner && billingMonth?.id && versions.length > 0 && (
        <OwnerRestorePanel
          billingMonthId={billingMonth.id}
          versions={versions
            .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, 'th') || (b.versionNo - a.versionNo))
            .map((v) => ({
              id: v.id,
              roomNumber: v.roomNumber,
              versionNo: v.versionNo,
              isActive: v.isActive,
              createdAt: v.createdAt.toISOString()
            }))}
        />
      )}
    </div>
  )
}
