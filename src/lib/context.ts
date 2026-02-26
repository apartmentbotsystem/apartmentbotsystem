import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'

export async function getActiveMonth(): Promise<{ year: number; month: number }> {
  const c = cookies()
  const yearStr = c.get('activeYear')?.value
  const monthStr = c.get('activeMonth')?.value
  const y = yearStr ? Number(yearStr) : undefined
  const m = monthStr ? Number(monthStr) : undefined
  if (y && m) return { year: y, month: m }
  const latest = await prisma.billingMonth.findFirst({ select: { year: true, month: true }, orderBy: [{ year: 'desc' }, { month: 'desc' }] })
  if (latest) return latest
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

export async function getActiveBuildingId(): Promise<string | null> {
  const c = cookies()
  const b = c.get('activeBuildingId')?.value ?? null
  return b && b !== '' ? b : null
}

export async function getActiveFloor(): Promise<number | null> {
  const c = cookies()
  const f = c.get('activeFloor')?.value ?? ''
  const n = f ? Number(f) : NaN
  return Number.isFinite(n) && n >= 1 && n <= 99 ? n : null
}

type ContextOptions = {
  monthOptions: Array<{ year: number; month: number }>
  buildingOptions: Array<{ id: string; name: string }>
  floorOptions: Array<{ idx: number; name: string }>
}

export async function getContextOptions(): Promise<ContextOptions> {
  const [monthOptions, buildingOptions, floorOptions] = await Promise.all([
    prisma.billingMonth.findMany({
      select: { year: true, month: true },
      distinct: ['year', 'month'],
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 24
    }),
    prisma.building.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.floor.findMany({ select: { idx: true, name: true }, orderBy: { idx: 'asc' } })
  ])
  return { monthOptions, buildingOptions, floorOptions }
}
