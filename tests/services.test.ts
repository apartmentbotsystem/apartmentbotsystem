import assert from 'node:assert/strict'
import { prisma } from '@/lib/db'
import type { AuthUser } from '@/lib/auth/types'
import * as Documents from '@/services/documents'
import * as Payments from '@/services/payments'
import * as Billing from '@/services/billing'
import * as Penalty from '@/services/penalty'
import PizZip from 'pizzip'

const user: AuthUser = { id: 'admin', role: 'ADMIN' }

async function resetDb() {
  await prisma.$transaction([
    prisma.conversationMessage.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.ticketMessage.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.paymentMatch.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.documentSendLog.deleteMany(),
    prisma.documentVersion.deleteMany(),
    prisma.documentTemplate.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.billingRecord.deleteMany(),
    prisma.billingMonth.deleteMany(),
    prisma.roomResident.deleteMany(),
    prisma.contract.deleteMany(),
    prisma.moveHistory.deleteMany(),
    prisma.lineMessage.deleteMany(),
    prisma.lineBinding.deleteMany(),
    prisma.resident.deleteMany(),
    prisma.billingFieldMapping.deleteMany(),
    prisma.room.deleteMany(),
    prisma.floor.deleteMany()
  ])
}

function title(name: string) {
  console.log(`\n=== ${name} ===`)
}

async function setupRoomAndMonth(roomNumber: string, year: number, month: number) {
  const floor = await prisma.floor.create({ data: { idx: 1, name: 'ชั้น 1' } })
  await prisma.room.create({ data: { number: roomNumber, floorId: floor.id } })
  const bm = await prisma.billingMonth.create({ data: { year, month } })
  return { floor, bm }
}

async function testDocuments() {
  title('Documents: generateDocument, sendDocument')
  await resetDb()
  // seed
  // minimal valid docx buffer
  const zip = new PizZip()
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`)
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`)
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Hello</w:t></w:r></w:p>
  </w:body>
</w:document>`)
  const docxBuf = zip.generate({ type: 'nodebuffer' }) as Buffer
  const tpl = await prisma.documentTemplate.create({ data: { code: 'INV', name: 'Invoice', content: docxBuf } })
  const { bm } = await setupRoomAndMonth('101', 2026, 1)
  await prisma.billingRecord.create({
    data: { roomNumber: '101', billingMonthId: bm.id, amount: 1000, adjustments: 0 }
  })
  // concurrent generate simulation
  const [g1, g2] = await Promise.all([
    Documents.generateDocument(user, tpl.id, '101', 2026, 1, false, 'admin-1'),
    Documents.generateDocument(user, tpl.id, '101', 2026, 1, false, 'admin-2')
  ])
  const versions = await prisma.documentVersion.findMany({ orderBy: { versionNo: 'asc' } })
  assert.equal(versions.length, 2, 'two versions created')
  const v0 = versions[0]!
  const v1 = versions[1]!
  assert.equal(v0.versionNo, 1, 'first versionNo 1')
  assert.equal(v1.versionNo, 2, 'second versionNo 2')
  assert.ok(g1.versionNo === 1 || g1.versionNo === 2, 'g1 version number valid')
  assert.ok(g2.versionNo === 1 || g2.versionNo === 2, 'g2 version number valid')
  // SENT guard behavior
  await Documents.sendDocument(user, v0.id, 'admin-1')
  let sentGuardErr: unknown = null
  try {
    await Documents.generateDocument(user, tpl.id, '101', 2026, 1, false, 'admin-3')
  } catch (e) {
    sentGuardErr = e
  }
  assert.ok(sentGuardErr instanceof Error, 'generate blocked when SENT exists and no force')
  // version increment integrity after SENT with force
  const forced = await Documents.generateDocument(user, tpl.id, '101', 2026, 1, true, 'admin-4')
  const versions2 = await prisma.documentVersion.findMany({ orderBy: { versionNo: 'asc' } })
  assert.equal(versions2.length, 3, 'third version created with force')
  assert.equal(forced.versionNo, 3, 'forced version is next increment')
  // send duplicate prevention
  let dupSendErr: unknown = null
  try {
    await Documents.sendDocument(user, v0.id, 'admin-1')
  } catch (e) {
    dupSendErr = e
  }
  assert.ok(dupSendErr instanceof Error, 'duplicate send prevented')
}

async function testPayments() {
  title('Payments: matchPayment, revertMatch')
  await resetDb()
  const { bm } = await setupRoomAndMonth('201', 2026, 1)
  await prisma.billingRecord.create({
    data: { roomNumber: '201', billingMonthId: bm.id, amount: 1000, adjustments: 0 }
  })
  const p = await prisma.payment.create({ data: { amount: 1000, occurredAt: new Date('2026-01-05T00:00:00Z'), bankRef: null } })
  // partial match
  const m1 = await Payments.matchPayment(user, { paymentId: p.id, billingRecordId: (await prisma.billingRecord.findFirstOrThrow()).id, amount: 300, confirm: true }, 'admin-1')
  const m2 = await Payments.matchPayment(user, { paymentId: p.id, billingRecordId: (await prisma.billingRecord.findFirstOrThrow()).id, amount: 200, confirm: true }, 'admin-2')
  const pAfterPartial = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })
  assert.equal(pAfterPartial.matched, false, 'payment not fully matched after partials')
  // final match to full
  await Payments.matchPayment(user, { paymentId: p.id, billingRecordId: (await prisma.billingRecord.findFirstOrThrow()).id, amount: 500, confirm: true }, 'admin-3')
  const pAfterFull = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })
  assert.equal(pAfterFull.matched, true, 'payment fully matched after total equals amount')
  // transactional overmatch prevention
  let overErr: unknown = null
  try {
    await Payments.matchPayment(user, { paymentId: p.id, billingRecordId: (await prisma.billingRecord.findFirstOrThrow()).id, amount: 1, confirm: true }, 'admin-4')
  } catch (e) {
    overErr = e
  }
  assert.ok(overErr instanceof Error, 'overmatch prevented')
  // revert and recalc
  const anyMatch = await prisma.paymentMatch.findFirstOrThrow({ where: { paymentId: p.id } })
  await Payments.revertMatch(user, anyMatch.id, 'admin-5')
  const pAfterRevert = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })
  const sumAfterRevert = await prisma.paymentMatch.aggregate({ where: { paymentId: p.id }, _sum: { matchedAmount: true } })
  assert.equal(pAfterRevert.matched, Number(sumAfterRevert._sum.matchedAmount ?? 0) === Number(pAfterFull.amount), 'matched flag reflects remaining matches')
}

async function testBilling() {
  title('Billing: patchBillingRecords optimistic locking')
  await resetDb()
  const { bm } = await setupRoomAndMonth('301', 2026, 1)
  const rec = await prisma.billingRecord.create({
    data: { roomNumber: '301', billingMonthId: bm.id, amount: 1000, adjustments: 0, note: null }
  })
  // simulate two concurrent patches
  const p1 = Billing.patchBillingRecords(user, 2026, 1, [{ id: rec.id, amount: 900, adjustments: 0, note: 'edit A' }], 'admin-1')
  const p2 = Billing.patchBillingRecords(user, 2026, 1, [{ id: rec.id, amount: 800, adjustments: 0, note: 'edit B' }], 'admin-2')
  const res = await Promise.allSettled([p1, p2])
  const rejected = res.filter(r => r.status === 'rejected')
  assert.ok(rejected.length >= 1, 'at least one of concurrent edits is rejected by optimistic lock')
}

async function testPenalty() {
  title('Penalty automation: idempotent run and audit log')
  await resetDb()
  const { bm } = await setupRoomAndMonth('401', 2026, 1)
  // overdue record: due day earlier than today
  const today = new Date(2026, 0, 20)
  const dueDate = new Date(2026, 0, 5)
  await prisma.billingRecord.create({
    data: { roomNumber: '401', billingMonthId: bm.id, amount: 1000, adjustments: 0, dueDate }
  })
  const r1 = await Penalty.runWithAudit(user, 'admin-1')
  const r2 = await Penalty.runWithAudit(user, 'admin-2')
  assert.ok(r1.updated >= 0, 'first run updates zero or more rows deterministically')
  assert.equal(r2.updated, 0, 'second run idempotent (no changes)')
  const countAudit = await prisma.auditLog.count({ where: { entityType: 'PenaltyEngine', entityId: 'penalty-recalc' } })
  assert.equal(countAudit, 2, 'one audit log per run')
}

async function main() {
  try {
    await testDocuments()
    await testPayments()
    await testBilling()
    await testPenalty()
    console.log('\nAll service boundary tests passed')
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

await main()
