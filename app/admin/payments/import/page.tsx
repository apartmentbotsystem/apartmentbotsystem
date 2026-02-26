"use client"
import { useState } from 'react'
import LoadingButton from '@/components/ui/LoadingButton'
import { useToast } from '@/components/ui/ToastProvider'

export default function PaymentsImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [sheet, setSheet] = useState('')
  type ImportResult = { ok: true; imported: number } | { error: string }
  const [result, setResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const { showSuccess, showError } = useToast()
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    if (sheet) fd.append('sheet', sheet)
    setLoading(true)
    try {
      const res = await fetch('/api/payments/import', { method: 'POST', body: fd })
      const json = await res.json()
      setResult(json)
      if ((json as { ok?: boolean }).ok) showSuccess('นำเข้าสำเร็จ')
      else showError((json as { error?: string }).error ?? 'Import failed')
    } finally {
      setLoading(false)
    }
  }
  return (
    <main className="container">
      <h1>อัปโหลดรายการชำระเงิน</h1>
      <form onSubmit={onSubmit}>
        <input type="file" accept=".xlsx,.xls" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        <input placeholder="ชื่อชีต (ถ้ามี)" value={sheet} onChange={e => setSheet(e.target.value)} />
        <LoadingButton loading={loading} disabled={!file} type="submit">นำเข้า</LoadingButton>
      </form>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </main>
  )
}
