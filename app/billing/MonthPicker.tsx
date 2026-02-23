"use client"
import { useRef } from 'react'
import { setActiveContext } from '../context-actions'

export default function MonthPicker({ year, month, months }: { year: number; month: number; months: Array<{ year: number; month: number }> }) {
  const formRef = useRef<HTMLFormElement>(null)
  const onChange = () => {
    formRef.current?.requestSubmit()
  }
  const years = Array.from(new Set(months.map(m => m.year)))
  return (
    <form ref={formRef} action={setActiveContext} className="flex items-center gap-1 text-sm">
      <span className="hidden sm:inline">Month</span>
      <select name="year" defaultValue={String(year)} onChange={onChange} className="border erp-border rounded px-2 py-1">
        {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
      </select>
      <select name="month" defaultValue={String(month)} onChange={onChange} className="border erp-border rounded px-2 py-1">
        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={String(m)}>{String(m).padStart(2, '0')}</option>)}
      </select>
      <input type="hidden" name="__via" value="month-autosubmit" />
    </form>
  )
}
