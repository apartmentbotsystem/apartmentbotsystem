import assert from 'node:assert/strict'
import { prisma } from '@/lib/db'
import type { DeliveryLog } from '@prisma/client'
import { DocumentStatus, DeliveryStatus } from '@prisma/client'
import { generateDocumentVersion } from '@/domain/document/versioning'
import { sendDocumentVersion, resendDocumentVersion } from '@/services/delivery'
import { setLineGateway } from '@/infrastructure/lineGateway'

async function resetDb() {
  await prisma.$transaction([
    prisma.deliveryLog.deleteMany(),
    prisma.documentSendLog.deleteMany(),
    prisma.documentVersion.deleteMany(),
    prisma.documentTemplate.deleteMany(),
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

async function setupPrereqs() {
  // template group and published template in Template Engine tables
  const group = await prisma.templateGroup.create({ data: { name: 'Main', type: 'BILLING' } })
  await prisma.template.create({ data: { groupId: group.id, version: 1, isDraft: false, isPublished: true, contentJson: {} } })
  const floor = await prisma.floor.upsert({ where: { idx: 7 }, update: {}, create: { idx: 7, name: 'ชั้น 7' } })
  await prisma.room.upsert({ where: { number: 'C101' }, update: { floorId: floor.id }, create: { number: 'C101', floorId: floor.id } })
  const bm = await prisma.billingMonth.create({ data: { year: 2026, month: 3 } })
  await prisma.billingRecord.upsert({
    where: { roomNumber_billingMonthId: { roomNumber: 'C101', billingMonthId: bm.id } },
    update: { amount: 1000, adjustments: 0 },
    create: { roomNumber: 'C101', billingMonthId: bm.id, amount: 1000, adjustments: 0 }
  })
  await prisma.billingVersion.create({
    data: { roomNumber: 'C101', billingMonthId: bm.id, versionNo: 1, snapshotData: { total: 1000 }, totalAmount: 1000, isActive: true, createdBy: 'tester' }
  })
  return { groupId: group.id, billingMonthId: bm.id }
}

async function main() {
  await resetDb()
  const { groupId, billingMonthId } = await setupPrereqs()
  setLineGateway({ sendLineMessage: async () => ({ messageId: 'msg-1' }) })
  const g = await generateDocumentVersion({ roomId: 'C101', billingMonth: billingMonthId, templateGroupId: groupId, actorId: 'tester' })
  const dv0 = await prisma.documentVersion.findUniqueOrThrow({ where: { id: g.id } })
  assert.equal(dv0.status, DocumentStatus.READY, 'generated version should be READY')
  // send success
  const s1 = await sendDocumentVersion({ documentVersionId: dv0.id, actorId: 'tester' })
  assert.equal(s1.status, 'SUCCESS')
  const afterS1 = await prisma.documentVersion.findUniqueOrThrow({ where: { id: dv0.id } })
  assert.equal(afterS1.status, DocumentStatus.SENT)
  const logs1 = await prisma.deliveryLog.findMany({ where: { documentVersionId: dv0.id } })
  assert.equal(logs1.length, 1)
  assert.equal(logs1[0]!.status, DeliveryStatus.SUCCESS)
  // send again without force should throw
  let blocked: unknown = null
  try {
    await sendDocumentVersion({ documentVersionId: dv0.id })
  } catch (e) { blocked = e }
  assert.ok(blocked instanceof Error, 'double-send without force should throw')
  // resend with failure
  setLineGateway({ sendLineMessage: async () => { throw new Error('line down') } })
  const s2 = await resendDocumentVersion(dv0.id, 'tester')
  assert.equal(s2.status, 'FAILED')
  const afterS2 = await prisma.documentVersion.findUniqueOrThrow({ where: { id: dv0.id } })
  assert.equal(afterS2.status, DocumentStatus.FAILED)
  // resend again with success
  setLineGateway({ sendLineMessage: async () => ({ messageId: 'msg-2' }) })
  const s3 = await resendDocumentVersion(dv0.id, 'tester')
  assert.equal(s3.status, 'SUCCESS')
  const afterS3 = await prisma.documentVersion.findUniqueOrThrow({ where: { id: dv0.id } })
  assert.equal(afterS3.status, DocumentStatus.SENT)
  const logsAll = await prisma.deliveryLog.findMany({ where: { documentVersionId: dv0.id } })
  assert.equal(logsAll.length, 3, 'multiple attempts recorded')
  const hasSuccess = logsAll.filter((l: DeliveryLog) => l.status === DeliveryStatus.SUCCESS).length
  const hasFailed = logsAll.filter((l: DeliveryLog) => l.status === DeliveryStatus.FAILED).length
  assert.ok(hasSuccess >= 2 && hasFailed >= 1, 'attempts have both success and failure as expected')
  const audits = await prisma.auditLog.findMany({ where: { entityType: 'DocumentVersion', entityId: dv0.id } })
  assert.ok(audits.find(a => a.action === 'DOCUMENT_SENT'), 'has sent audit')
  assert.ok(audits.find(a => a.action === 'DOCUMENT_SEND_FAILED'), 'has failed audit')
  console.log('\nDelivery Phase C tests passed')
  await prisma.$disconnect()
}

void main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
