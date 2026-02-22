import { prisma } from './src/lib/db'
import { ensureBillingMonth, ensureFloor, ensureRoom, patchBillingRecords } from './src/services/billing'
import type { AuthUser } from './src/lib/auth/types'
import { toNumberSafe } from './src/lib/decimal'
import type { Prisma } from '@prisma/client'

async function main() {
  const year = 2026
  const month = 2
  const floor = await ensureFloor(8123, 'F8123')
  await ensureRoom('TMP-100', floor.id)
  const bm = await ensureBillingMonth(year, month)
  const existing = await prisma.billingRecord.findFirst({ where: { roomNumber: 'TMP-100', billingMonthId: bm.id } })
  const record = existing ?? await prisma.billingRecord.create({
    data: { roomNumber: 'TMP-100', billingMonthId: bm.id, amount: 100, adjustments: 0 }
  })
  const existingV = await prisma.billingVersion.findFirst({ where: { roomNumber: 'TMP-100', billingMonthId: bm.id } })
  if (!existingV) {
    await prisma.billingVersion.create({
      data: {
        roomNumber: record.roomNumber,
        billingMonthId: record.billingMonthId,
        versionNo: 1,
        snapshotData: {
          id: record.id,
          roomNumber: record.roomNumber,
          billingMonthId: record.billingMonthId,
          amount: toNumberSafe(record.amount),
          adjustments: toNumberSafe(record.adjustments),
          note: record.note ?? null,
          dueDate: record.dueDate ? record.dueDate.toISOString() : null,
          penalty: toNumberSafe(record.penalty ?? 0),
          status: record.status,
          updatedAt: record.updatedAt.toISOString()
        },
        totalAmount: toNumberSafe(record.amount) + toNumberSafe(record.adjustments) + toNumberSafe(record.penalty ?? 0),
        isActive: true,
        createdBy: 'system'
      }
    })
  }
  const beforeCount = await prisma.billingVersion.count({ where: { roomNumber: 'TMP-100', billingMonthId: bm.id } })
  const user: AuthUser = { id: 'admin', role: 'ADMIN' }
  await patchBillingRecords(user, year, month, [{ id: record.id, amount: 150, adjustments: 0, note: null }], user.id)
  const afterCount = await prisma.billingVersion.count({ where: { roomNumber: 'TMP-100', billingMonthId: bm.id } })
  const latest = await prisma.billingVersion.findFirst({
    where: { roomNumber: 'TMP-100', billingMonthId: bm.id, isActive: true },
    orderBy: { versionNo: 'desc' }
  })
  if (!latest) throw new Error('missing latest after update')
  const target = await prisma.billingVersion.findFirst({
    where: { roomNumber: 'TMP-100', billingMonthId: bm.id, versionNo: 1 }
  })
  if (!target) throw new Error('missing target v1')
  const current = await prisma.billingVersion.findFirst({
    where: { roomNumber: 'TMP-100', billingMonthId: bm.id, isActive: true },
    orderBy: { versionNo: 'desc' }
  })
  if (!current) throw new Error('missing active version')
  const rec2 = await prisma.billingRecord.findFirst({ where: { id: record.id } })
  if (!rec2) throw new Error('record missing')
  const snap = target.snapshotData as any
  const updated = await prisma.billingRecord.update({
    where: { id: rec2.id },
    data: {
      amount: toNumberSafe(snap.amount ?? rec2.amount),
      adjustments: toNumberSafe(snap.adjustments ?? rec2.adjustments),
      note: snap.note ?? rec2.note,
      dueDate: snap.dueDate ? new Date(snap.dueDate as string) : rec2.dueDate,
      penalty: toNumberSafe(snap.penalty ?? rec2.penalty)
    }
  })
  await prisma.billingVersion.update({ where: { id: current.id }, data: { isActive: false } })
  const totalAmount = toNumberSafe(updated.amount) + toNumberSafe(updated.adjustments) + toNumberSafe(updated.penalty ?? 0)
  const snapForCreate: Prisma.InputJsonValue = JSON.parse(JSON.stringify(target.snapshotData))
  const newV = await prisma.billingVersion.create({
    data: {
      roomNumber: updated.roomNumber,
      billingMonthId: updated.billingMonthId,
      versionNo: current.versionNo + 1,
      snapshotData: snapForCreate,
      totalAmount,
      createdBy: 'admin',
      isActive: true,
      revertedFromId: target.id
    }
  })
  const revertRes = { id: newV.id, versionNo: newV.versionNo }
  console.log(JSON.stringify({
    beforeCount,
    afterCount,
    latestVersionNo: latest.versionNo,
    revertVersion: revertRes
  }, null, 2))
}

main().finally(async () => {
  await prisma.$disconnect()
})
