'use server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function setActiveContext(formData: FormData) {
  const year = String(formData.get('year') ?? '')
  const month = String(formData.get('month') ?? '')
  const buildingId = String(formData.get('buildingId') ?? '')
  const floor = String(formData.get('floor') ?? '')
  const c = cookies()
  if (year) c.set('activeYear', year, { httpOnly: true, sameSite: 'lax', path: '/' })
  if (month) c.set('activeMonth', month, { httpOnly: true, sameSite: 'lax', path: '/' })
  c.set('activeBuildingId', buildingId, { httpOnly: true, sameSite: 'lax', path: '/' })
  c.set('activeFloor', floor, { httpOnly: true, sameSite: 'lax', path: '/' })
  revalidatePath('/', 'layout')
}
