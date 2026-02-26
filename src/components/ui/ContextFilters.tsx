'use client'
import { usePathname } from 'next/navigation'
import TopContextForm from '@/app/top-context-form'

type MonthOption = { year: number; month: number }
type BuildingOption = { id: string; name: string }
type FloorOption = { idx: number; name: string }

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

export default function ContextFilters(props: Props) {
  const pathname = usePathname() || '/'
  const allowedPrefixes = [
    '/dashboard',
    '/billing',
    '/payments',
    '/rooms',
    '/tenants',
    '/analytics',
    '/line',
    '/occupancy'
  ]
  const disallowedPrefixes = [
    '/settings',
    '/audit',
    '/login',
    '/admin'
  ]
  const show =
    allowedPrefixes.some((p) => pathname === p || pathname.startsWith(p + '/')) &&
    !disallowedPrefixes.some((p) => pathname === p || pathname.startsWith(p + '/'))

  if (!show) return null

  return (
    <details className="relative">
      <summary className="chip cursor-pointer select-none">Filters</summary>
      <div className="absolute right-0 mt-2 erp-card p-2 min-w-[420px] shadow-lg">
        <TopContextForm
          activeYear={props.activeYear}
          activeMonth={props.activeMonth}
          activeBuildingId={props.activeBuildingId}
          activeFloor={props.activeFloor}
          monthOptions={props.monthOptions}
          buildingOptions={props.buildingOptions}
          floorOptions={props.floorOptions}
          onSetContext={props.onSetContext}
        />
      </div>
    </details>
  )
}

