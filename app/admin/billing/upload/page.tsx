'use client'
import { useState } from 'react'
import LoadingButton from '@/components/ui/LoadingButton'
import { useToast } from '@/components/ui/ToastProvider'
import { REQUIRED_BILLING_HEADERS } from '@/domain/billing/excelSchema'

const HEADER_ALIASES: Record<string, string[]> = {
  เดือน: ['month'],
  ห้อง: ['room', 'room number', 'roomnumber'],
  ชื่อบัญชี: ['account name', 'name'],
  ธนาคาร: ['bank'],
  หมายเลขบัญชี: ['account no', 'account number', 'account'],
  ค่าเช่า: ['rent'],
  น้ำก่อน: ['water before'],
  น้ำหลัง: ['water after'],
  ใช้น้ำ: ['water used'],
  ค่าน้ำต่อหน่วย: ['water rate'],
  ค่าบริการมิเตอร์น้ำ: ['water meter fee'],
  รวมค่าน้ำ: ['water', 'water total'],
  ไฟก่อน: ['electric before'],
  ไฟหลัง: ['electric after'],
  ใช้ไฟ: ['electric used'],
  ค่าไฟต่อหน่วย: ['electric rate'],
  ค่าบริการมิเตอร์ไฟ: ['electric meter fee'],
  รวมค่าไฟ: ['electric', 'electric total'],
  เฟอร์: ['furniture'],
  'อื่นๆ': ['other'],
  รวมเงิน: ['amount', 'total', 'grand total'],
  หมายเหตุ: ['note', 'remark']
}

type BillingImportResult = { ok: true; year: number; month: number; processed: number } | { error: string }

function normalizeHeader(value: unknown): string {
  return String(value ?? '').replace(/\u00A0/g, ' ').trim().replace(/\s+/g, ' ')
}

function findBestMatch(target: string, detectedHeaders: string[]): string {
  if (detectedHeaders.includes(target)) return target
  const lowerMap = new Map(detectedHeaders.map((h) => [h.toLowerCase(), h] as const))
  const aliases = HEADER_ALIASES[target] ?? []
  for (const alias of aliases) {
    const hit = lowerMap.get(alias.toLowerCase())
    if (hit) return hit
  }
  return ''
}

async function readExcelHeaders(file: File): Promise<string[]> {
  const XLSX = await import('xlsx')
  const ab = await file.arrayBuffer()
  const wb = XLSX.read(ab, { type: 'array', cellFormula: false, cellHTML: false, cellNF: false, cellText: false })
  const uniq = new Map<string, true>()
  const expected = new Set(REQUIRED_BILLING_HEADERS.map((h) => normalizeHeader(h).toLowerCase()))
  const aliasSet = new Set<string>()
  for (const aliases of Object.values(HEADER_ALIASES)) {
    for (const a of aliases) aliasSet.add(a.toLowerCase())
  }

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false })
    if (!rows.length) continue
    let bestIdx = 0
    let bestScore = -1
    const limit = Math.min(rows.length, 12)
    for (let i = 0; i < limit; i++) {
      const row = rows[i] ?? []
      let score = 0
      for (const cell of row) {
        const h = normalizeHeader(cell).toLowerCase()
        if (!h) continue
        if (expected.has(h) || aliasSet.has(h)) score++
      }
      if (score > bestScore) {
        bestScore = score
        bestIdx = i
      }
    }
    const headerRow = rows[bestIdx] ?? []
    for (const cell of headerRow) {
      const header = normalizeHeader(cell)
      if (!header) continue
      if (!uniq.has(header)) uniq.set(header, true)
    }
  }

  return Array.from(uniq.keys())
}

function buildAutoMapping(detectedHeaders: string[]): Record<string, string> {
  return Object.fromEntries(
    REQUIRED_BILLING_HEADERS.map((target) => [target, findBestMatch(target, detectedHeaders)])
  )
}

export default function BillingUploadPage() {
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1)
  const [file, setFile] = useState<File | null>(null)
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([])
  const [headerMapping, setHeaderMapping] = useState<Record<string, string>>(
    () => Object.fromEntries(REQUIRED_BILLING_HEADERS.map((h) => [h, '']))
  )
  const [result, setResult] = useState<BillingImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [readingHeaders, setReadingHeaders] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [strict, setStrict] = useState(false)
  const { showSuccess, showError } = useToast()

  const handleFileSelected = async (nextFile: File | null) => {
    setFile(nextFile)
    setResult(null)
    if (!nextFile) {
      setDetectedHeaders([])
      setHeaderMapping(Object.fromEntries(REQUIRED_BILLING_HEADERS.map((h) => [h, ''])))
      return
    }

    setReadingHeaders(true)
    try {
      const headers = await readExcelHeaders(nextFile)
      setDetectedHeaders(headers)
      setHeaderMapping(buildAutoMapping(headers))
    } catch {
      setDetectedHeaders([])
      setHeaderMapping(Object.fromEntries(REQUIRED_BILLING_HEADERS.map((h) => [h, ''])))
      showError('อ่านหัวตารางจากไฟล์ไม่สำเร็จ')
    } finally {
      setReadingHeaders(false)
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    const missingTargets = REQUIRED_BILLING_HEADERS.filter((target) => !(headerMapping[target] ?? '').trim())
    if (missingTargets.length > 0) {
      showError(`ยัง map ไม่ครบ 22 ช่อง: ${missingTargets.join(', ')}`)
      return
    }

    const ab = await file.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(ab)))
    const mappingEntries = Object.entries(headerMapping)
      .map(([target, source]) => [target, source.trim()] as const)
      .filter(([target, source]) => source.length > 0 && source !== target)
    const headerMappingPayload = mappingEntries.length > 0 ? Object.fromEntries(mappingEntries) : undefined

    setLoading(true)
    try {
      const csrf = document.cookie.split('; ').find((c) => c.startsWith('csrf='))?.split('=')[1] ?? ''
      const res = await fetch('/api/billing/import', {
        method: 'POST',
        headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
        body: JSON.stringify({ filename: file.name, fileBase64: base64, year, month, strict, headerMapping: headerMappingPayload })
      })
      const json = await res.json()
      setResult(json)
      if ((json as { ok?: boolean }).ok) {
        showSuccess('Billing import completed')
        setTimeout(() => {
          window.location.href = `/billing?year=${year}&month=${month}`
        }, 300)
      }
      else {
        const msg = (json as { message?: string; error?: string; code?: string })
        showError(msg.message ?? msg.error ?? (msg.code ? `Import failed: ${msg.code}` : 'Import failed'))
      }
    } finally {
      setLoading(false)
    }
  }

  const billingMonth = new Date(year, month - 1, 1)
  const consumptionMonth = new Date(year, month - 2, 1)

  return (
    <main className="container space-y-3">
      <h1 className="text-lg font-semibold">Upload Monthly Billing Excel</h1>

      <div className="p-3 border erp-border rounded text-sm space-y-1">
        <div className="font-semibold">
          Billing Month: {billingMonth.toLocaleString('en-US', { month: 'long' })} {year}
        </div>
        <div className="opacity-80">
          Consumption Period: {consumptionMonth.toLocaleString('en-US', { month: 'long' })} {consumptionMonth.getFullYear()}
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-2">
        <div>
          <label className="text-sm">Year</label>
          <input className="ml-2 border erp-border rounded px-2 py-1" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
        <div>
          <label className="text-sm">Month</label>
          <input className="ml-2 border erp-border rounded px-2 py-1" type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} />
          Strict mode (รีเซ็ตข้อมูลเดือนนี้ก่อน import)
        </label>
        <div
          className={`border-2 border-dashed rounded p-4 text-sm ${dragOver ? 'border-primary bg-[var(--bg-surface)]' : 'erp-border'}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const dropped = e.dataTransfer.files?.[0] ?? null
            void handleFileSelected(dropped)
          }}
        >
          <div className="font-medium">Drag & Drop Excel Here</div>
          <div className="opacity-70">หรือเลือกไฟล์จากเครื่อง (.xlsx, .xls)</div>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              void handleFileSelected(e.target.files?.[0] ?? null)
            }}
            className="mt-2"
          />
          <div className="text-xs mt-1">{file ? `Selected: ${file.name}` : 'No file selected'}</div>
          <div className="text-xs mt-1 opacity-80">
            {readingHeaders ? 'กำลังอ่านหัวตารางจาก Excel...' : `พบหัวตารางจากไฟล์: ${detectedHeaders.length} ช่อง`}
          </div>
        </div>
        <LoadingButton loading={loading} disabled={!file || readingHeaders} type="submit">Import</LoadingButton>
      </form>

      <section className="border erp-border rounded overflow-hidden">
        <div className="px-3 py-2 border-b erp-border text-sm font-semibold">Mapping 22 ช่องระบบ -&gt; หัวตารางจาก Excel</div>
        <div className="overflow-auto">
          <table className="w-full text-xs min-w-[620px]">
            <thead>
              <tr className="[&>th]:px-2 [&>th]:py-2 border-b erp-border text-left">
                <th>System Field (บังคับ)</th>
                <th>Excel Header ที่จะใช้</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {REQUIRED_BILLING_HEADERS.map((h) => (
                <tr key={h} className="[&>td]:px-2 [&>td]:py-1 border-b erp-border">
                  <td>{h}</td>
                  <td>
                    <select
                      className="border erp-border rounded px-1 py-0.5 w-full"
                      value={headerMapping[h] ?? ''}
                      onChange={(e) => {
                        const value = e.target.value
                        setHeaderMapping((prev) => ({ ...prev, [h]: value }))
                      }}
                    >
                      <option value="">-- ยังไม่เลือก --</option>
                      {detectedHeaders.map((header) => (
                        <option key={`${h}:${header}`} value={header}>{header}</option>
                      ))}
                    </select>
                  </td>
                  <td><span className="chip">{(headerMapping[h] ?? '').trim() ? 'Mapped' : 'Missing'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-2 border-t erp-border text-xs opacity-80">
          ระบบยึด 22 ช่องมาตรฐานเป็นตัวตั้ง แล้วเลือกหัวตารางจากไฟล์มา mapping ให้ครบก่อน import
        </div>
      </section>

      {result && <pre className="text-xs border erp-border rounded p-2">{JSON.stringify(result, null, 2)}</pre>}
    </main>
  )
}
