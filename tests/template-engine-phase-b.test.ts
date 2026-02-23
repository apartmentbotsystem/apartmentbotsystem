import assert from 'node:assert/strict'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { generateDocumentVersion } from '@/domain/document/versioning'

async function resetDb() {
  await prisma.$transaction([
    prisma.documentSendLog.deleteMany(),
    prisma.documentVersion.deleteMany(),
    prisma.template.deleteMany(),
    prisma.templateGroup.deleteMany(),
    prisma.billingVersion.deleteMany(),
    prisma.billingRecord.deleteMany(),
    prisma.billingMonth.deleteMany(),
    prisma.room.deleteMany(),
    prisma.floor.deleteMany(),
    prisma.auditLog.deleteMany()
  ])
}

async function setupRoomAndMonth(roomNumber: string, year: number, month: number) {
  const floor = await prisma.floor.upsert({ where: { idx: 9 }, update: {}, create: { idx: 9, name: 'ชั้น 9' } })
  await prisma.room.upsert({ where: { number: roomNumber }, update: { floorId: floor.id }, create: { number: roomNumber, floorId: floor.id } })
  const bm = await prisma.billingMonth.create({ data: { year, month } })
  return { floor, bm }
}

async function createPublishedTemplateGroup() {
  const group = await prisma.templateGroup.create({ data: { name: 'Billing Main', type: 'BILLING' } })
  const t = await prisma.template.create({ data: { groupId: group.id, version: 1, isDraft: false, isPublished: true, contentJson: {} } })
  return { group, t }
}

async function createActiveBillingVersion(roomNumber: string, billingMonthId: string, total: number, snap: unknown) {
  await prisma.billingRecord.upsert({
    where: { roomNumber_billingMonthId: { roomNumber, billingMonthId } },
    create: { roomNumber, billingMonthId, amount: total, adjustments: 0 },
    update: { amount: total, adjustments: 0 }
  })
  return prisma.billingVersion.create({
    data: {
      roomNumber,
      billingMonthId,
      versionNo: 1,
      snapshotData: snap as Prisma.InputJsonValue,
      totalAmount: total,
      isActive: true,
      createdBy: 'test'
    }
  })
}

async function main() {
  // version chain: v1 then v2
  await resetDb()
  const { group } = await createPublishedTemplateGroup()
  const { bm } = await setupRoomAndMonth('T101', 2026, 1)
  await createActiveBillingVersion('T101', bm.id, 1000, { charges: { rent: 1000 }, total: 1000 })
  const g1 = await generateDocumentVersion({ roomId: 'T101', billingMonth: bm.id, templateGroupId: group.id, actorId: 'tester' })
  const g2 = await generateDocumentVersion({ roomId: 'T101', billingMonth: bm.id, templateGroupId: group.id, actorId: 'tester' })
  assert.equal(g1.version, 1)
  assert.equal(g2.version, 2)

  // SENT guard
  const latest = await prisma.documentVersion.findFirstOrThrow({ where: { roomNumber: 'T101', billingMonthId: bm.id }, orderBy: { versionNo: 'desc' } })
  await prisma.documentVersion.update({ where: { id: latest.id }, data: { status: 'SENT' } })
  let blocked: unknown = null
  try {
    await generateDocumentVersion({ roomId: 'T101', billingMonth: bm.id, templateGroupId: group.id, actorId: 'tester' })
  } catch (e) { blocked = e }
  assert.ok(blocked instanceof Error, 'regenerate blocked when SENT and no confirm')
  const forced = await generateDocumentVersion({ roomId: 'T101', billingMonth: bm.id, templateGroupId: group.id, confirmRegenerate: true, actorId: 'tester' })
  assert.equal(forced.version, 3)

  // billing change detection
  await prisma.billingVersion.updateMany({ where: { roomNumber: 'T101', billingMonthId: bm.id }, data: { isActive: false } })
  await prisma.billingVersion.create({
    data: { roomNumber: 'T101', billingMonthId: bm.id, versionNo: 2, snapshotData: { charges: { rent: 1200 }, total: 1200 }, totalAmount: 1200, isActive: true, createdBy: 'test2' }
  })
  const changed = await generateDocumentVersion({ roomId: 'T101', billingMonth: bm.id, templateGroupId: group.id, actorId: 'tester' })
  assert.equal(changed.billingChanged, true)

  // zero amount
  const { bm: bm2 } = await setupRoomAndMonth('T101', 2026, 2)
  await createActiveBillingVersion('T101', bm2.id, 0, { charges: {}, total: 0 })
  const zero = await generateDocumentVersion({ roomId: 'T101', billingMonth: bm2.id, templateGroupId: group.id, actorId: 'tester' })
  assert.equal(zero.isZeroAmount, true)
  const zeroDoc = await prisma.documentVersion.findFirstOrThrow({ where: { roomNumber: 'T101', billingMonthId: bm2.id }, orderBy: { versionNo: 'desc' } })
  const zeroAudit = await prisma.auditLog.findFirst({ where: { action: 'ZERO_AMOUNT_GENERATED', entityId: zeroDoc.id } })
  assert.ok(zeroAudit, 'zero amount audit exists')

  // monthly reset: new month should start at version 1
  assert.equal(zero.version, 1)

  console.log('\nTemplate Engine Phase B tests passed')
  await prisma.$disconnect()
}

void main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
