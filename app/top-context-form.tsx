'use client'

type MonthOption = {
  year: number
  month: number
}

type BuildingOption = {
  id: string
  name: string
}

type FloorOption = {
  idx: number
  name: string
}

type Props = {
  activeYear: number
  activeMonth: number
  activeBuildingId: string
  activeFloor: number | null
  monthOptions: MonthOption[]
  buildingOptions: BuildingOption[]
  floorOptions: FloorOption[]
  onSetContext: (formData: FormData) => Promise<void>
}

export default function TopContextForm(props: Props) {
  const { activeYear, activeMonth, activeBuildingId, activeFloor, monthOptions, buildingOptions, floorOptions, onSetContext } = props

  const years = Array.from(new Set(monthOptions.map((m) => m.year))).sort((a, b) => b - a)
  const monthsForYear = Array.from({ length: 12 }, (_, i) => i + 1)
  const autoSubmit = (el: HTMLSelectElement) => {
    el.form?.requestSubmit()
  }

  return (
    <form action={onSetContext} className="flex flex-wrap items-center gap-2 text-xs">
      <span className="chip">บริบท</span>

      <select name="year" defaultValue={String(activeYear)} className="border erp-border rounded px-2 py-1" onChange={(e) => autoSubmit(e.currentTarget)}>
        {years.map((y) => (<option key={y} value={String(y)}>{y}</option>))}
      </select>

      <select name="month" defaultValue={String(activeMonth)} className="border erp-border rounded px-2 py-1" onChange={(e) => autoSubmit(e.currentTarget)}>
        {(monthsForYear.length ? monthsForYear : [activeMonth]).map((m) => {
          const key = `${activeYear}-${String(m).padStart(2, '0')}`
          return <option key={key} value={String(m)}>{key}</option>
        })}
      </select>

      <select name="buildingId" defaultValue={activeBuildingId} className="border erp-border rounded px-2 py-1" onChange={(e) => autoSubmit(e.currentTarget)}>
        <option value="">ทั้งหมด</option>
        {buildingOptions.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
      </select>

      <select name="floor" defaultValue={activeFloor ? String(activeFloor) : ''} className="border erp-border rounded px-2 py-1" onChange={(e) => autoSubmit(e.currentTarget)}>
        <option value="">ทั้งหมด</option>
        {floorOptions.map((f) => (<option key={f.idx} value={f.idx}>ชั้น {f.idx}</option>))}
      </select>
    </form>
  )
}
