import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import LineWebhookStatus from './LineWebhookStatus'

const GENERAL_KEY = 'settings:general'
const ENV_KEY = 'settings:environment'
const FORMAT_KEY = 'settings:number-format'

type JsonObject = Record<string, string | number | boolean | null>

async function getSetting(key: string): Promise<JsonObject> {
  const row = await prisma.systemSetting.findUnique({ where: { key } })
  if (!row || !row.value || typeof row.value !== 'object' || Array.isArray(row.value)) return {}
  return row.value as JsonObject
}

async function saveSetting(key: string, value: JsonObject) {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value }
  })
}

export default async function SettingsPage() {
  const [general, env, format] = await Promise.all([
    getSetting(GENERAL_KEY),
    getSetting(ENV_KEY),
    getSetting(FORMAT_KEY)
  ])

  async function saveGeneral(formData: FormData) {
    'use server'
    await saveSetting(GENERAL_KEY, {
      buildingName: String(formData.get('buildingName') ?? ''),
      address: String(formData.get('address') ?? ''),
      contactPhone: String(formData.get('contactPhone') ?? ''),
      bankAccount: String(formData.get('bankAccount') ?? '')
    })
    revalidatePath('/settings')
  }

  async function saveEnvironment(formData: FormData) {
    'use server'
    await saveSetting(ENV_KEY, {
      databaseUrl: String(formData.get('databaseUrl') ?? ''),
      lineChannelToken: String(formData.get('lineChannelToken') ?? ''),
      lineSecret: String(formData.get('lineSecret') ?? ''),
      billingDay: Number(formData.get('billingDay') ?? 1),
      dueDay: Number(formData.get('dueDay') ?? 7),
      overdueDay: Number(formData.get('overdueDay') ?? 15),
      runHour: Number(formData.get('runHour') ?? 2)
    })
    revalidatePath('/settings')
  }

  async function saveFormat(formData: FormData) {
    'use server'
    await saveSetting(FORMAT_KEY, {
      currency: String(formData.get('currency') ?? 'THB'),
      decimal: Number(formData.get('decimal') ?? 2)
    })
    revalidatePath('/settings')
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">ตั้งค่า</h1>

      <section className="border erp-border rounded p-3 space-y-2">
        <h2 className="font-semibold">ทั่วไป</h2>
        <form action={saveGeneral} className="grid gap-2 md:grid-cols-2">
          <input name="buildingName" placeholder="ชื่ออาคาร" defaultValue={String(general.buildingName ?? '')} className="border erp-border rounded px-2 py-1" />
          <input name="contactPhone" placeholder="เบอร์ติดต่อ" defaultValue={String(general.contactPhone ?? '')} className="border erp-border rounded px-2 py-1" />
          <input name="address" placeholder="ที่อยู่" defaultValue={String(general.address ?? '')} className="border erp-border rounded px-2 py-1 md:col-span-2" />
          <input name="bankAccount" placeholder="บัญชีธนาคาร" defaultValue={String(general.bankAccount ?? '')} className="border erp-border rounded px-2 py-1 md:col-span-2" />
          <button type="submit" className="px-3 py-1 border erp-border rounded w-fit">บันทึกข้อมูลทั่วไป</button>
        </form>
      </section>

      <section className="border erp-border rounded p-3 space-y-2">
        <h2 className="font-semibold">สภาพแวดล้อมระบบ</h2>
        <form action={saveEnvironment} className="grid gap-2 md:grid-cols-2">
          <input name="databaseUrl" placeholder="Database URL" defaultValue={String(env.databaseUrl ?? '')} className="border erp-border rounded px-2 py-1 md:col-span-2" />
          <input name="lineChannelToken" placeholder="LINE Channel Token" defaultValue={String(env.lineChannelToken ?? '')} className="border erp-border rounded px-2 py-1" />
          <input name="lineSecret" placeholder="LINE Secret" defaultValue={String(env.lineSecret ?? '')} className="border erp-border rounded px-2 py-1" />
          <input name="billingDay" type="number" min={1} max={31} placeholder="billingDay" defaultValue={String(env.billingDay ?? 1)} className="border erp-border rounded px-2 py-1" />
          <input name="dueDay" type="number" min={1} max={31} placeholder="dueDay" defaultValue={String(env.dueDay ?? 7)} className="border erp-border rounded px-2 py-1" />
          <input name="overdueDay" type="number" min={1} max={31} placeholder="overdueDay" defaultValue={String(env.overdueDay ?? 15)} className="border erp-border rounded px-2 py-1" />
          <input name="runHour" type="number" min={0} max={23} placeholder="runHour" defaultValue={String(env.runHour ?? 2)} className="border erp-border rounded px-2 py-1" />
          <button type="submit" className="px-3 py-1 border erp-border rounded w-fit">บันทึกค่าสภาพแวดล้อม</button>
        </form>
      </section>

      <section className="border erp-border rounded p-3 space-y-2">
        <h2 className="font-semibold">LINE Webhook</h2>
        <LineWebhookStatus />
      </section>

      <section className="border erp-border rounded p-3 space-y-2">
        <h2 className="font-semibold">รูปแบบตัวเลข</h2>
        <form action={saveFormat} className="grid gap-2 md:grid-cols-2">
          <input name="currency" placeholder="สกุลเงิน" defaultValue={String(format.currency ?? 'THB')} className="border erp-border rounded px-2 py-1" />
          <input name="decimal" type="number" min={0} max={6} placeholder="ทศนิยม" defaultValue={String(format.decimal ?? 2)} className="border erp-border rounded px-2 py-1" />
          <button type="submit" className="px-3 py-1 border erp-border rounded w-fit">บันทึกรูปแบบตัวเลข</button>
        </form>
      </section>
    </div>
  )
}


