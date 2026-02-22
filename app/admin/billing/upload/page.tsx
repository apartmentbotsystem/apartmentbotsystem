"use client"
import { useState } from 'react'
import LoadingButton from '@/components/ui/LoadingButton'
import { useToast } from '@/components/ui/ToastProvider'

export default function BillingUploadPage() {
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1)
  const [file, setFile] = useState<File | null>(null)
  type BillingImportResult = { ok: true; year: number; month: number; processed: number } | { error: string }
  const [result, setResult] = useState<BillingImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const { showSuccess, showError } = useToast()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('year', String(year))
    fd.append('month', String(month))
    setLoading(true)
    try {
      const res = await fetch('/api/billing/import', { method: 'POST', body: fd })
      const json = await res.json()
      setResult(json)
      if ((json as { ok?: boolean }).ok) showSuccess('นำเข้าบิลสำเร็จ')
      else showError((json as { error?: string }).error ?? 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="container">
      <h1>อัปโหลดบิลรายเดือน</h1>
      <form onSubmit={onSubmit}>
        <div>
          <label>ปี: </label>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
        <div>
          <label>เดือน: </label>
          <input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} />
        </div>
        <div>
          <input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <LoadingButton loading={loading} disabled={!file} type="submit">นำเข้า</LoadingButton>
      </form>
      {result && (
        <pre>{JSON.stringify(result, null, 2)}</pre>
      )}
    </main>
  )
}
