'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { CellFocusedEvent, CellValueChangedEvent, ColDef } from 'ag-grid-community'
import { REQUIRED_BILLING_HEADERS, toNumberFromExcel } from '@/domain/billing/excelSchema'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'

type BillingEditorRow = {
  id: string
  roomNumber: string
  adjustments: number
  raw: Record<string, string>
}

type Props = {
  year: number
  month: number
  locked: boolean
  initialRows: BillingEditorRow[]
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

type SheetRow = {
  id: string
  roomNumber: string
  adjustments: number
} & Record<string, string | number>

const H = {
  month: 0,
  room: 1,
  rent: 5,
  waterBefore: 6,
  waterAfter: 7,
  waterUsed: 8,
  waterUnit: 9,
  waterMeter: 10,
  waterTotal: 11,
  elecBefore: 12,
  elecAfter: 13,
  elecUsed: 14,
  elecUnit: 15,
  elecMeter: 16,
  elecTotal: 17,
  furniture: 18,
  other: 19,
  grand: 20,
  note: 21
} as const

const CALC_INDEXES: Set<number> = new Set([H.waterUsed, H.waterTotal, H.elecUsed, H.elecTotal, H.grand])
const THAI_KEYBOARD_NUMERIC_MAP: Record<string, string> = {
  'ๅ': '1',
  'ภ': '4',
  'ถ': '5',
  'ุ': '6',
  'ึ': '7',
  'ค': '8',
  'ต': '9',
  'จ': '0'
}
const SYMBOL_NUMERIC_MAP: Record<string, string> = {
  '!': '1',
  '@': '2',
  '#': '3',
  '$': '4',
  '%': '5',
  '^': '6',
  '&': '7',
  '*': '8',
  '(': '9',
  ')': '0'
}

function hKey(index: number): string {
  return `h${index}`
}

function formatMoney(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

function parseNum(value: unknown): number {
  const n = toNumberFromExcel(value)
  return Number.isFinite(n) ? n : 0
}

function normalizeNumericTyping(value: string): string {
  let s = String(value ?? '')
  s = s.replace(/[๐-๙]/g, (ch) => {
    const n = toNumberFromExcel(ch)
    return Number.isFinite(n) ? String(n) : ch
  })
  s = s.replace(/[ๅภถุึคตจ]/g, (ch) => THAI_KEYBOARD_NUMERIC_MAP[ch] ?? ch)
  s = s.replace(/[!@#$%^&*()]/g, (ch) => SYMBOL_NUMERIC_MAP[ch] ?? ch)
  s = s.replace(/,/g, '')
  s = s.replace(/[^0-9.\-]/g, '')
  const isNegative = s.startsWith('-')
  s = s.replace(/-/g, '')
  if (isNegative) s = `-${s}`
  const firstDot = s.indexOf('.')
  if (firstDot !== -1) s = `${s.slice(0, firstDot + 1)}${s.slice(firstDot + 1).replace(/\./g, '')}`
  return s
}

function calcRow(row: SheetRow): SheetRow {
  const next = { ...row }
  const rent = parseNum(next[hKey(H.rent)])
  const wb = parseNum(next[hKey(H.waterBefore)])
  const wa = parseNum(next[hKey(H.waterAfter)])
  const wu = Math.max(0, wa - wb)
  const wur = parseNum(next[hKey(H.waterUnit)])
  const wmf = parseNum(next[hKey(H.waterMeter)])
  const wt = wu * wur + wmf

  const eb = parseNum(next[hKey(H.elecBefore)])
  const ea = parseNum(next[hKey(H.elecAfter)])
  const eu = Math.max(0, ea - eb)
  const eur = parseNum(next[hKey(H.elecUnit)])
  const emf = parseNum(next[hKey(H.elecMeter)])
  const et = eu * eur + emf

  const furniture = parseNum(next[hKey(H.furniture)])
  const other = parseNum(next[hKey(H.other)])
  const grand = rent + wt + et + furniture + other

  next[hKey(H.waterUsed)] = formatMoney(wu)
  next[hKey(H.waterTotal)] = formatMoney(wt)
  next[hKey(H.elecUsed)] = formatMoney(eu)
  next[hKey(H.elecTotal)] = formatMoney(et)
  next[hKey(H.grand)] = formatMoney(grand)
  return next
}

function toSheetRows(rows: BillingEditorRow[]): SheetRow[] {
  return rows.map((r) => {
    const row: SheetRow = { id: r.id, roomNumber: r.roomNumber, adjustments: r.adjustments }
    for (let i = 0; i < REQUIRED_BILLING_HEADERS.length; i++) {
      const header = REQUIRED_BILLING_HEADERS[i]
      row[hKey(i)] = r.raw[header] ?? ''
    }
    row[hKey(H.room)] = r.roomNumber
    return calcRow(row)
  })
}

function rowToPayload(row: SheetRow) {
  const rent = parseNum(row[hKey(H.rent)])
  const water = parseNum(row[hKey(H.waterTotal)])
  const electric = parseNum(row[hKey(H.elecTotal)])
  const other = parseNum(row[hKey(H.furniture)]) + parseNum(row[hKey(H.other)])
  const amount = parseNum(row[hKey(H.grand)])

  const raw: Record<string, string> = {}
  for (let i = 0; i < REQUIRED_BILLING_HEADERS.length; i++) {
    raw[REQUIRED_BILLING_HEADERS[i]] = String(row[hKey(i)] ?? '')
  }
  raw[REQUIRED_BILLING_HEADERS[H.room]] = row.roomNumber

  return {
    id: row.id,
    rent,
    water,
    electric,
    other,
    amount,
    adjustments: parseNum(row.adjustments),
    note: String(row[hKey(H.note)] ?? ''),
    raw
  }
}

function getCsrfToken(): string {
  return document.cookie.split('; ').find((c) => c.startsWith('csrf='))?.split('=')[1] ?? ''
}

function isEditableField(field: string): boolean {
  if (field === 'adjustments') return true
  if (!field.startsWith('h')) return false
  const idx = Number(field.slice(1))
  if (!Number.isFinite(idx)) return false
  if (idx === H.room) return false
  if (CALC_INDEXES.has(idx)) return false
  return true
}

function isNumericField(field: string): boolean {
  if (field === 'adjustments') return true
  if (!field.startsWith('h')) return false
  const idx = Number(field.slice(1))
  return idx >= 5 && idx <= 20
}

function normalizeFieldValue(field: string, value: unknown): string | number {
  if (field === 'adjustments') return parseNum(value)
  if (isNumericField(field)) return normalizeNumericTyping(String(value ?? ''))
  return String(value ?? '')
}

const GRID_FIELD_ORDER = [
  ...Array.from({ length: REQUIRED_BILLING_HEADERS.length }, (_, i) => hKey(i)),
  'adjustments'
]

export default function BillingGridClient({ year, month, locked, initialRows }: Props) {
  const [rows, setRows] = useState<SheetRow[]>(() => toSheetRows(initialRows))
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string>('')
  const [focused, setFocused] = useState<{ rowIndex: number; field: string; header: string } | null>(null)
  const [formulaText, setFormulaText] = useState('')
  const dirtyIdsRef = useRef<Set<string>>(new Set())
  const rowsRef = useRef<SheetRow[]>(rows)
  const isSavingRef = useRef(false)
  const pendingSaveRef = useRef(false)
  const rowRevisionRef = useRef<Map<string, number>>(new Map())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gridWrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const next = toSheetRows(initialRows)
    setRows(next)
    rowsRef.current = next
    dirtyIdsRef.current.clear()
    rowRevisionRef.current = new Map(next.map((r) => [r.id, 0] as const))
    setSaveState('idle')
    setLastSavedAt('')
    setFocused(null)
    setFormulaText('')
  }, [initialRows])

  useEffect(() => {
    rowsRef.current = rows
  }, [rows])

  const saveRows = async () => {
    if (locked) return
    if (isSavingRef.current) {
      pendingSaveRef.current = true
      return
    }

    const targetIds = Array.from(dirtyIdsRef.current)
    if (targetIds.length === 0) return

    const revisionSnapshot = new Map<string, number>()
    for (const id of targetIds) revisionSnapshot.set(id, rowRevisionRef.current.get(id) ?? 0)

    const targetSet = new Set(targetIds)
    const payloadRows = rowsRef.current.filter((r) => targetSet.has(r.id)).map(rowToPayload)
    if (payloadRows.length === 0) return

    isSavingRef.current = true
    setSaveState('saving')
    try {
      const res = await fetch('/api/billing/records', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': getCsrfToken()
        },
        body: JSON.stringify({ year, month, rows: payloadRows })
      })
      if (!res.ok) throw new Error(`HTTP_${res.status}`)

      for (const id of targetIds) {
        const before = revisionSnapshot.get(id) ?? 0
        const current = rowRevisionRef.current.get(id) ?? 0
        if (before === current) dirtyIdsRef.current.delete(id)
      }

      setSaveState('saved')
      setLastSavedAt(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1200)
    } catch {
      setSaveState('error')
    } finally {
      isSavingRef.current = false
      if (pendingSaveRef.current || dirtyIdsRef.current.size > 0) {
        pendingSaveRef.current = false
        void saveRows()
      }
    }
  }

  const queueAutosave = () => {
    if (locked) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void saveRows()
    }, 800)
  }

  const onCellValueChanged = (e: CellValueChangedEvent<SheetRow>) => {
    if (locked) return
    const field = String(e.colDef.field ?? '')
    if (!field) return
    const row = e.data
    if (!row) return

    const rowId = row.id
    if (!rowId) return

    const idx = field.startsWith('h') ? Number(field.slice(1)) : -1
    let next = { ...row }

    if (field === 'adjustments') {
      next.adjustments = parseNum(e.newValue)
    } else if (idx >= 0) {
      if (idx === H.room || CALC_INDEXES.has(idx)) return
      const isNumeric = idx >= 5 && idx <= 20
      const normalized = isNumeric ? normalizeNumericTyping(String(e.newValue ?? '')) : String(e.newValue ?? '')
      next[field] = normalized
      next = calcRow(next)
    } else {
      return
    }

    setRows((prev) => prev.map((r) => (r.id === rowId ? next : r)))
    dirtyIdsRef.current.add(rowId)
    rowRevisionRef.current.set(rowId, (rowRevisionRef.current.get(rowId) ?? 0) + 1)
    queueAutosave()
  }

  const applyEdits = (edits: Array<{ rowIndex: number; field: string; value: unknown }>) => {
    if (locked || edits.length === 0) return
    const grouped = new Map<number, Array<{ field: string; value: unknown }>>()
    for (const edit of edits) {
      if (!isEditableField(edit.field)) continue
      const list = grouped.get(edit.rowIndex) ?? []
      list.push(edit)
      grouped.set(edit.rowIndex, list)
    }
    if (grouped.size === 0) return

    const touchedIds: string[] = []
    setRows((prev) =>
      prev.map((row, rowIndex) => {
        const changes = grouped.get(rowIndex)
        if (!changes || changes.length === 0) return row
        let next: SheetRow = { ...row }
        for (const c of changes) {
          next = { ...next, [c.field]: normalizeFieldValue(c.field, c.value) }
        }
        next = calcRow(next)
        touchedIds.push(next.id)
        return next
      })
    )
    for (const id of touchedIds) {
      dirtyIdsRef.current.add(id)
      rowRevisionRef.current.set(id, (rowRevisionRef.current.get(id) ?? 0) + 1)
    }
    queueAutosave()
  }

  const onCellFocused = (e: CellFocusedEvent<SheetRow>) => {
    if (e.rowIndex == null || !e.column || typeof e.column === 'string') return
    const field = e.column.getColDef().field
    if (!field) return
    const header = e.column.getColDef().headerName ?? field
    setFocused({ rowIndex: e.rowIndex, field, header })
    const row = rowsRef.current[e.rowIndex]
    if (!row) return
    setFormulaText(String((row as Record<string, unknown>)[field] ?? ''))
  }

  const applyFormulaBar = () => {
    if (!focused || locked) return
    const field = focused.field
    const row = rowsRef.current[focused.rowIndex]
    if (!row) return
    const idx = field.startsWith('h') ? Number(field.slice(1)) : -1
    if (field === 'adjustments') {
      const next = { ...row, adjustments: parseNum(formulaText) }
      setRows((prev) => prev.map((r, i) => (i === focused.rowIndex ? next : r)))
      dirtyIdsRef.current.add(row.id)
      rowRevisionRef.current.set(row.id, (rowRevisionRef.current.get(row.id) ?? 0) + 1)
      queueAutosave()
      return
    }
    if (idx < 0 || idx === H.room || CALC_INDEXES.has(idx)) return
    const isNumeric = idx >= 5 && idx <= 20
    const normalized = isNumeric ? normalizeNumericTyping(formulaText) : formulaText
    const next = calcRow({ ...row, [field]: normalized })
    setRows((prev) => prev.map((r, i) => (i === focused.rowIndex ? next : r)))
    dirtyIdsRef.current.add(row.id)
    rowRevisionRef.current.set(row.id, (rowRevisionRef.current.get(row.id) ?? 0) + 1)
    queueAutosave()
  }

  const fillDownFocused = () => {
    if (!focused || locked) return
    const field = focused.field
    if (!isEditableField(field)) return
    const sourceRow = rowsRef.current[focused.rowIndex]
    if (!sourceRow) return
    const sourceValue = (sourceRow as Record<string, unknown>)[field]
    const edits: Array<{ rowIndex: number; field: string; value: unknown }> = []
    for (let r = focused.rowIndex + 1; r < rowsRef.current.length; r++) {
      edits.push({ rowIndex: r, field, value: sourceValue })
    }
    applyEdits(edits)
  }

  const handleGridPaste = (text: string) => {
    if (!focused || locked) return
    const startRow = focused.rowIndex
    const startField = focused.field
    const startCol = GRID_FIELD_ORDER.indexOf(startField)
    if (startRow < 0 || startCol < 0) return

    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.length > 0)
    if (lines.length === 0) return
    const matrix = lines.map((line) => line.split('\t'))
    const edits: Array<{ rowIndex: number; field: string; value: unknown }> = []

    for (let r = 0; r < matrix.length; r++) {
      const targetRow = startRow + r
      if (targetRow >= rowsRef.current.length) break
      for (let c = 0; c < matrix[r].length; c++) {
        const targetCol = startCol + c
        if (targetCol >= GRID_FIELD_ORDER.length) break
        const field = GRID_FIELD_ORDER[targetCol]
        if (!isEditableField(field)) continue
        edits.push({ rowIndex: targetRow, field, value: matrix[r][c] })
      }
    }

    applyEdits(edits)
  }

  const totals = useMemo(() => {
    return rows.reduce(
      (sum, row) => {
        sum.rent += parseNum(row[hKey(H.rent)])
        sum.water += parseNum(row[hKey(H.waterTotal)])
        sum.electric += parseNum(row[hKey(H.elecTotal)])
        sum.other += parseNum(row[hKey(H.furniture)]) + parseNum(row[hKey(H.other)])
        sum.adjustments += parseNum(row.adjustments)
        sum.amount += parseNum(row[hKey(H.grand)])
        return sum
      },
      { rent: 0, water: 0, electric: 0, other: 0, adjustments: 0, amount: 0 }
    )
  }, [rows])

  const columnDefs = useMemo<ColDef<SheetRow>[]>(() => {
    const cols: ColDef<SheetRow>[] = [
      {
        colId: '__rownum__',
        headerName: '#',
        valueGetter: (p) => (p.node?.rowPinned ? '' : String((p.node?.rowIndex ?? 0) + 1)),
        editable: false,
        pinned: 'left',
        width: 56,
        minWidth: 56,
        maxWidth: 70,
        cellClass: 'billing-rownum'
      }
    ]
    cols.push(...REQUIRED_BILLING_HEADERS.map((header, idx) => {
      const key = hKey(idx)
      const isRoom = idx === H.room
      const isCalc = CALC_INDEXES.has(idx)
      const isNumeric = idx >= 5 && idx <= 20
      const isNote = idx === H.note
      const col: ColDef<SheetRow> = {
        field: key,
        headerName: header,
        editable: !locked && !isRoom && !isCalc,
        pinned: isRoom ? ('left' as const) : undefined,
        width: isNote ? 260 : isNumeric ? 130 : 150,
        minWidth: isNote ? 220 : 110,
        cellStyle: isCalc ? { background: 'rgba(148,163,184,0.12)' } : undefined,
        valueFormatter: (p) => String(p.value ?? ''),
        type: isNumeric ? 'numericColumn' : undefined
      }
      return col
    }))

    cols.push({
      field: 'adjustments',
      headerName: 'ปรับปรุง',
      editable: !locked,
      width: 130,
      valueFormatter: (p: { value: unknown }) => formatMoney(parseNum(p.value))
    })

    return cols
  }, [locked])

  const pinnedBottomRowData = useMemo<SheetRow[]>(() => {
    const row: SheetRow = { id: '__total__', roomNumber: '', adjustments: totals.adjustments }
    for (let i = 0; i < REQUIRED_BILLING_HEADERS.length; i++) row[hKey(i)] = ''
    row[hKey(H.room)] = 'รวม'
    row[hKey(H.rent)] = formatMoney(totals.rent)
    row[hKey(H.waterTotal)] = formatMoney(totals.water)
    row[hKey(H.elecTotal)] = formatMoney(totals.electric)
    row[hKey(H.other)] = formatMoney(totals.other)
    row[hKey(H.grand)] = formatMoney(totals.amount)
    return [row]
  }, [totals])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="opacity-70">Spreadsheet mode: single-click edit, copy/paste ได้ทั้งช่วง, คำนวณสดและบันทึกอัตโนมัติ</div>
        {!locked && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fillDownFocused}
              className="px-2 py-1 border erp-border rounded"
              disabled={!focused || saveState === 'saving'}
            >
              Fill Down (Ctrl+D)
            </button>
            <button
              type="button"
              onClick={() => void saveRows()}
              className="px-2 py-1 border erp-border rounded"
              disabled={saveState === 'saving'}
            >
              บันทึกทั้งหมด
            </button>
            <span className="chip">
              {saveState === 'saving' && 'กำลังบันทึก...'}
              {saveState === 'saved' && `บันทึกแล้ว ${lastSavedAt}`}
              {saveState === 'error' && 'บันทึกล้มเหลว'}
              {saveState === 'idle' && `รอซิงก์ ${dirtyIdsRef.current.size} แถว`}
            </span>
            <span className="opacity-70">ลัด: Ctrl+V วางช่วง, Ctrl+D เติมลง</span>
          </div>
        )}
      </div>

      <div
        ref={gridWrapRef}
        className="ag-theme-alpine"
        style={{ height: '72vh', width: '100%', borderRadius: 10, overflow: 'hidden' }}
        onPasteCapture={(e) => {
          if (locked) return
          const text = e.clipboardData?.getData('text/plain') ?? ''
          if (!text || !focused) return
          e.preventDefault()
          handleGridPaste(text)
        }}
        onKeyDownCapture={(e) => {
          if (locked) return
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
            e.preventDefault()
            fillDownFocused()
          }
        }}
      >
        <div className="px-2 py-2 border-b erp-border bg-white flex items-center gap-2 text-xs">
          <span className="font-semibold opacity-70">fx</span>
          <input
            value={formulaText}
            onChange={(e) => setFormulaText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyFormulaBar()
              }
            }}
            disabled={!focused || locked}
            placeholder={focused ? `แก้ไขเซลล์: ${focused.header}` : 'เลือกเซลล์ก่อนเพื่อแก้ผ่าน formula bar'}
            className="flex-1 border erp-border rounded px-2 py-1 text-sm"
          />
          <button type="button" onClick={applyFormulaBar} disabled={!focused || locked} className="px-2 py-1 border erp-border rounded">
            Apply
          </button>
        </div>
        <AgGridReact<SheetRow>
          rowData={rows}
          columnDefs={columnDefs}
          pinnedBottomRowData={pinnedBottomRowData}
          defaultColDef={{
            sortable: false,
            resizable: true,
            filter: false,
            singleClickEdit: true
          }}
          suppressRowClickSelection
          rowSelection="multiple"
          undoRedoCellEditing
          undoRedoCellEditingLimit={30}
          stopEditingWhenCellsLoseFocus
          onCellFocused={onCellFocused}
          onCellValueChanged={onCellValueChanged}
          readOnlyEdit={false}
          ensureDomOrder
        />
      </div>
      <style jsx global>{`
        .ag-theme-alpine {
          --ag-foreground-color: #1f2937;
          --ag-background-color: #ffffff;
          --ag-row-hover-color: #f6f9fe;
          --ag-header-background-color: #f8fafc;
          --ag-odd-row-background-color: #ffffff;
          --ag-border-color: #e5e7eb;
          --ag-font-size: 13px;
          --ag-font-family: 'Noto Sans Thai', 'Sarabun', system-ui, sans-serif;
        }
        .ag-theme-alpine .ag-header-cell-label {
          font-weight: 600;
        }
        .ag-theme-alpine .billing-rownum {
          color: #6b7280;
          background: #f8fafc;
          text-align: center;
        }
      `}</style>
    </div>
  )
}
