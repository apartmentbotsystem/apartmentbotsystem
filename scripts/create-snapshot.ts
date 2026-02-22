import { prisma } from '../src/lib/db'
import { logger } from '../src/lib/logging/file-logger'

async function snapshotMonth(year: number, month: number) {
  const bm = await prisma.billingMonth.findFirst({ where: { year, month } })
  if (!bm) {
    await logger.warn('snapshot skipped: billingMonth not found', { year, month })
    return
  }
  const key = `billing-month:${year}-${month}`
  const exists = await prisma.systemSnapshot.findFirst({ where: { snapshotKey: key } })
  if (exists) {
    await logger.info('snapshot exists', { snapshotKey: key })
    return
  }
  const records = await prisma.billingRecord.findMany({ where: { billingMonthId: bm.id } })
  const versions = await prisma.billingVersion.findMany({ where: { billingMonthId: bm.id } })
  const matches = await prisma.paymentMatch.findMany({ where: { billingRecordId: { in: records.map(r => r.id) } } })
  const paymentsSummary = {
    totalMatched: matches.reduce((s, m) => s + Number(m.matchedAmount ?? 0), 0),
    totalRecords: records.length
  }
  const snapshot = {
    year,
    month,
    billingMonthId: bm.id,
    records: records.map(r => ({
      id: r.id,
      roomNumber: r.roomNumber,
      amount: Number(r.amount),
      adjustments: Number(r.adjustments),
      note: r.note ?? null,
      dueDate: r.dueDate ? r.dueDate.toISOString() : null,
      overdueDays: r.overdueDays,
      penalty: Number(r.penalty ?? 0),
      status: r.status
    })),
    versions: versions.map(v => ({
      id: v.id,
      roomNumber: v.roomNumber,
      billingMonthId: v.billingMonthId,
      versionNo: v.versionNo,
      totalAmount: Number(v.totalAmount),
      isActive: v.isActive,
      createdAt: v.createdAt.toISOString(),
      createdBy: v.createdBy
    })),
    paymentsSummary
  }
  await prisma.systemSnapshot.create({ data: { snapshotKey: key, data: snapshot } })
  await logger.info('snapshot created', { snapshotKey: key, size: JSON.stringify(snapshot).length })
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length >= 2) {
    const y = Number(args[0])
    const m = Number(args[1])
    if (Number.isFinite(y) && Number.isFinite(m)) {
      await snapshotMonth(y, m)
      return
    }
  }
  const closed = await prisma.billingMonth.findMany({ where: { closed: true } })
  for (const bm of closed) {
    await snapshotMonth(bm.year, bm.month)
  }
}

void main().finally(async () => {
  await prisma.$disconnect()
})
