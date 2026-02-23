import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import LineWebhookStatus from './LineWebhookStatus'
import EnvStatus from './EnvStatus'

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
  const [_, env, format] = await Promise.all([
    getSetting(GENERAL_KEY),
    getSetting(ENV_KEY),
    getSetting(FORMAT_KEY)
  ])
  let dbOk = false
  try {
    await prisma.$queryRaw`SELECT 1`
    dbOk = true
  } catch {
    dbOk = false
  }

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
        <h2 className="font-semibold">สภาพแวดล้อมระบบ</h2>
        <form action={saveEnvironment} className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Database URL</label>
            <input name="databaseUrl" placeholder="Database URL" defaultValue={String(env.databaseUrl ?? '')} className="border erp-border rounded px-2 py-1 w-full" />
            <div className="text-xs opacity-70 mt-1">สถานะฐานข้อมูล: {dbOk ? 'เชื่อมต่อได้' : 'เชื่อมต่อไม่ได้'}</div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">LINE Channel Token</label>
            <input name="lineChannelToken" placeholder="LINE Channel Token" defaultValue={String(env.lineChannelToken ?? '')} className="border erp-border rounded px-2 py-1 w-full" />
            <div className="text-xs opacity-70 mt-1">ใช้ค่านี้เป็นหลัก หากเว้นว่างจะใช้จาก Environment</div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">LINE Secret</label>
            <input name="lineSecret" placeholder="LINE Secret" defaultValue={String(env.lineSecret ?? '')} className="border erp-border rounded px-2 py-1 w-full" />
            <div className="text-xs opacity-70 mt-1">ใช้ค่านี้เป็นหลัก หากเว้นว่างจะใช้จาก Environment</div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">billingDay</label>
            <input name="billingDay" type="number" min={1} max={31} placeholder="billingDay" defaultValue={String(env.billingDay ?? 1)} className="border erp-border rounded px-2 py-1 w-full" />
            <div className="text-xs opacity-70 mt-1">วันที่ตัดบิลของแต่ละเดือน เช่น 1 คือวันที่ 1</div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">dueDay</label>
            <input name="dueDay" type="number" min={1} max={31} placeholder="dueDay" defaultValue={String(env.dueDay ?? 7)} className="border erp-border rounded px-2 py-1 w-full" />
            <div className="text-xs opacity-70 mt-1">กำหนดวันครบกำหนดชำระ นับเป็นวันที่ในเดือน</div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">overdueDay</label>
            <input name="overdueDay" type="number" min={1} max={31} placeholder="overdueDay" defaultValue={String(env.overdueDay ?? 15)} className="border erp-border rounded px-2 py-1 w-full" />
            <div className="text-xs opacity-70 mt-1">วันที่เริ่มถือว่าเกินกำหนด ใช้คำนวณค่าปรับ</div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">runHour</label>
            <input name="runHour" type="number" min={0} max={23} placeholder="runHour" defaultValue={String(env.runHour ?? 2)} className="border erp-border rounded px-2 py-1 w-full" />
            <div className="text-xs opacity-70 mt-1">ชั่วโมงที่งานกำหนดการทำงาน เช่น งานสร้างบิล จะรันเวลาเท่านี้</div>
          </div>
          <button type="submit" className="px-3 py-1 border erp-border rounded w-fit">บันทึกค่าสภาพแวดล้อม</button>
        </form>
        <EnvStatus />
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


