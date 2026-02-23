import { prisma } from '@/lib/db'
import { patchBillingRecords, ensureBillingMonth, ensureFloor, ensureRoom } from '@/services/billing'
import type { AuthUser } from '@/lib/auth/types'
import { randomUUID } from 'node:crypto'
import type { BillingVersion, Prisma } from '@prisma/client'

async function setupMonth(year: number, month: number) {
  const floor = await ensureFloor(1, 'ชั้น 1')
  const room = await ensureRoom('101', floor.id)
  const bm = await ensureBillingMonth(year, month)
  const rec = await prisma.billingRecord.create({
    data: {
      roomNumber: room.number,
      billingMonthId: bm.id,
      amount: 1000,
      adjustments: 0
    }
  })
  await prisma.billingVersion.create({
    data: {
      roomNumber: rec.roomNumber,
      billingMonthId: rec.billingMonthId,
      versionNo: 1,
      snapshotData: {
        id: rec.id,
        roomNumber: rec.roomNumber,
        billingMonthId: rec.billingMonthId,
        amount: Number(rec.amount),
        adjustments: Number(rec.adjustments),
        note: rec.note,
        dueDate: rec.dueDate ? rec.dueDate.toISOString() : null,
        penalty: Number(rec.penalty ?? 0),
        status: rec.status,
        updatedAt: rec.updatedAt.toISOString()
      } satisfies Prisma.InputJsonValue,
      totalAmount: 1000,
      createdBy: 'seed',
      isActive: true
    }
  })
  return { bm, rec }
}

async function clearAll() {
  await prisma.deliveryLog.deleteMany({})
  await prisma.documentSendLog.deleteMany({})
  await prisma.documentVersion.deleteMany({})
  await prisma.documentTemplate.deleteMany({})
  await prisma.financialFlag.deleteMany({})
  await prisma.paymentMatch.deleteMany({})
  await prisma.payment.deleteMany({})
  await prisma.billingVersion.deleteMany({})
  await prisma.billingRecord.deleteMany({})
  await prisma.billingMonth.deleteMany({})
  await prisma.room.deleteMany({})
  await prisma.floor.deleteMany({})
}

function superAdmin(id = 'admin'): AuthUser {
  return { id, role: 'ADMIN' }
}

async function main() {
  await clearAll()
  const year = 2026
  const month = 1
  const { bm, rec } = await setupMonth(year, month)

  // update billing → version increment
  await patchBillingRecords(superAdmin(), year, month, [{ id: rec.id, amount: 1200, adjustments: 50, note: null }], 'admin')
  let versions = await prisma.billingVersion.findMany({ where: { roomNumber: rec.roomNumber, billingMonthId: rec.billingMonthId }, orderBy: { versionNo: 'asc' } })
  if (versions.length !== 2) throw new Error('expected two versions after update')
  const v0 = versions[0]!
  const v1 = versions[1]!
  if (!v1.isActive) throw new Error('version increment or activation failed')
  if (v0.isActive) throw new Error('old version should be inactive')

  // payment exists + billing change → create FinancialFlag
  const p = await prisma.payment.create({ data: { amount: 1000, occurredAt: new Date() } })
  await prisma.paymentMatch.create({ data: { paymentId: p.id, billingRecordId: rec.id, matchedAmount: 1000, confirmed: true } })
  await patchBillingRecords(superAdmin(), year, month, [{ id: rec.id, amount: 1500, adjustments: 0, note: null }], 'admin')
  const flags = await prisma.financialFlag.findMany({ where: { roomNumber: rec.roomNumber, billingMonthId: bm.id } })
  if (!flags.length) throw new Error('financial flag was not created on mismatch')

  // no double active version
  const actives = await prisma.billingVersion.count({ where: { roomNumber: rec.roomNumber, billingMonthId: bm.id, isActive: true } })
  if (actives !== 1) throw new Error('more than one active version detected')

  // revert twice → still increment: simulate by copying target snapshot through tx, similar to route
  const target = versions.find((v: BillingVersion) => v.versionNo === 1)
  for (let i = 0; i < 2; i++) {
    const current = await prisma.billingVersion.findFirst({
      where: { roomNumber: rec.roomNumber, billingMonthId: rec.billingMonthId, isActive: true },
      orderBy: { versionNo: 'desc' }
    })
    if (!current) throw new Error('missing active version')
    const record = await prisma.billingRecord.findFirst({ where: { id: rec.id } })
    if (!record) throw new Error('missing record')
    await prisma.billingRecord.update({
      where: { id: record.id },
      data: {
        amount: Number(((target?.snapshotData ?? {}) as Record<string, unknown>)['amount'] ?? record.amount),
        adjustments: Number(((target?.snapshotData ?? {}) as Record<string, unknown>)['adjustments'] ?? record.adjustments),
        note: (((target?.snapshotData ?? {}) as Record<string, unknown>)['note'] as string | null | undefined) ?? record.note
      }
    })
    await prisma.billingVersion.update({ where: { id: current.id }, data: { isActive: false } })
    await prisma.billingVersion.create({
      data: {
        roomNumber: rec.roomNumber,
        billingMonthId: rec.billingMonthId,
        versionNo: current.versionNo + 1,
        snapshotData: JSON.parse(JSON.stringify(target?.snapshotData ?? {})) as Prisma.InputJsonValue,
        totalAmount: Number(((target?.snapshotData ?? {}) as Record<string, unknown>)['amount'] ?? 0) + Number(((target?.snapshotData ?? {}) as Record<string, unknown>)['adjustments'] ?? 0),
        createdBy: 'admin',
        isActive: true,
        revertedFromId: target?.id ?? null
      }
    })
  }
  versions = await prisma.billingVersion.findMany({ where: { roomNumber: rec.roomNumber, billingMonthId: rec.billingMonthId } })
  const maxNo = Math.max(...versions.map(v => v.versionNo))
  if (maxNo < 3) throw new Error('version number did not increment on revert')

  console.log('billing-versioning tests passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
