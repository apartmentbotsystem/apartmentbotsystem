import { prisma } from '../src/lib/db'
import { logger } from '../src/lib/logging/file-logger'
import { promises as fs } from 'node:fs'
import path from 'node:path'

async function checkBillingVersionActive(): Promise<string[]> {
  const issues: string[] = []
  const rows = await prisma.$queryRaw<{ roomnumber: string; billingmonthid: string; cnt: bigint }[]>`
    SELECT "roomNumber" AS roomnumber, "billingMonthId" AS billingmonthid, COUNT(*)::bigint AS cnt
    FROM "BillingVersion" WHERE "isActive" = true
    GROUP BY "roomNumber", "billingMonthId"
    HAVING COUNT(*) > 1
  `
  for (const r of rows) {
    issues.push(`MULTIPLE_ACTIVE_VERSION ${r.roomnumber}/${r.billingmonthid} count=${r.cnt}`)
  }
  return issues
}

async function checkBillingTotals(): Promise<string[]> {
  const issues: string[] = []
  const rows = await prisma.$queryRaw<{ roomnumber: string; billingmonthid: string; total: number; amount: number; adjustments: number; penalty: number }[]>`
    SELECT br."roomNumber" AS roomnumber, br."billingMonthId" AS billingmonthid,
      bv."totalAmount"::float AS total,
      br.amount::float AS amount,
      br.adjustments::float AS adjustments,
      br.penalty::float AS penalty
    FROM "BillingRecord" br
    JOIN "BillingVersion" bv ON bv."roomNumber" = br."roomNumber" AND bv."billingMonthId" = br."billingMonthId" AND bv."isActive" = true
  `
  for (const r of rows) {
    const recTotal = (r.amount ?? 0) + (r.adjustments ?? 0) + (r.penalty ?? 0)
    if (Math.abs(recTotal - (r.total ?? 0)) > 0.0001) {
      issues.push(`TOTAL_MISMATCH ${r.roomnumber}/${r.billingmonthid} version=${r.total} record=${recTotal}`)
      await prisma.financialFlag.create({
        data: { roomNumber: r.roomnumber, billingMonthId: r.billingmonthid, type: 'TOTAL_MISMATCH', difference: recTotal - (r.total ?? 0) }
      })
    }
  }
  return issues
}

async function checkDocumentHashes(): Promise<string[]> {
  const issues: string[] = []
  const docs = await prisma.documentVersion.findMany({
    select: { id: true, roomNumber: true, billingMonthId: true, versionNo: true, hash: true, templateId: true }
  })
  for (const d of docs) {
    let totalAmount = 0
    if (d.billingMonthId) {
      const v = await prisma.billingVersion.findFirst({
        where: { roomNumber: d.roomNumber, billingMonthId: d.billingMonthId, isActive: true },
        orderBy: { versionNo: 'desc' }
      })
      totalAmount = v ? Number(v.totalAmount) : 0
    }
    const payload = JSON.stringify({
      roomNumber: d.roomNumber,
      billingMonthId: d.billingMonthId,
      totalAmount,
      versionNo: d.versionNo,
      templateId: d.templateId
    })
    const crypto = await import('node:crypto')
    const recomputed = crypto.createHash('sha256').update(payload).digest('hex')
    if (recomputed !== d.hash) {
      issues.push(`HASH_MISMATCH ${d.id}`)
    }
  }
  return issues
}

async function checkIdempotency(): Promise<string[]> {
  const issues: string[] = []
  const tenMinutes = 10 * 60 * 1000
  const cutoff = new Date(Date.now() - tenMinutes)
  const old = await prisma.idempotencyRecord.count({ where: { createdAt: { lt: cutoff } } })
  if (old > 0) {
    issues.push(`IDEMPOTENCY_OLD ${old}`)
  }
  return issues
}

async function checkFinancialFlagThreshold(): Promise<string[]> {
  const issues: string[] = []
  const unresolved = await prisma.financialFlag.count({ where: { resolved: false } })
  const threshold = Number(process.env['FINANCIAL_FLAG_THRESHOLD'] ?? '50')
  if (unresolved > threshold) {
    issues.push(`FINANCIAL_FLAG_THRESHOLD ${unresolved}`)
  }
  return issues
}

async function main() {
  const allIssues: string[] = []
  allIssues.push(...await checkBillingVersionActive())
  allIssues.push(...await checkBillingTotals())
  allIssues.push(...await checkDocumentHashes())
  allIssues.push(...await checkIdempotency())
  allIssues.push(...await checkFinancialFlagThreshold())
  if (allIssues.length) {
    await logger.error('Integrity check found issues', { issues: allIssues })
    const critical = allIssues.filter(x => /^(TOTAL_MISMATCH|MULTIPLE_ACTIVE_VERSION|HASH_MISMATCH|FINANCIAL_FLAG_THRESHOLD)/.test(x))
    if (critical.length) {
      const out = { level: 'CRITICAL', issues: critical, ts: new Date().toISOString() }
      const dir = path.resolve('logs')
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(path.join(dir, `alert-${Date.now()}.log`), JSON.stringify(out, null, 2), { encoding: 'utf8' })
      // eslint-disable-next-line no-console
      console.error('CRITICAL ALERT', JSON.stringify(out))
    }
  } else {
    await logger.info('Integrity check passed')
  }
}

void main().finally(async () => {
  await prisma.$disconnect()
})
