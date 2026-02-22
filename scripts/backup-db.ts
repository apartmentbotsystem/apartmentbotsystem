import { promises as fs } from 'node:fs'
import path from 'node:path'
import { prisma } from '../src/lib/db'
import { logger } from '../src/lib/logging/file-logger'
import crypto from 'node:crypto'

async function exportJson() {
  const months = await prisma.billingMonth.findMany()
  const records = await prisma.billingRecord.findMany()
  const versions = await prisma.billingVersion.findMany()
  const payments = await prisma.payment.findMany()
  const matches = await prisma.paymentMatch.findMany()
  const docs = await prisma.documentVersion.findMany({ select: { id: true, templateId: true, roomNumber: true, billingMonthId: true, versionNo: true, status: true, generatedAt: true, hash: true } })
  return { months, records, versions, payments, matches, docs }
}

function encrypt(buf: Buffer, passphrase: string): Buffer {
  const key = crypto.createHash('sha256').update(passphrase).digest()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(buf), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([Buffer.from('v1'), iv, tag, enc])
}

async function main() {
  const key = process.env['BACKUP_ENCRYPTION_KEY']
  if (!key) {
    // eslint-disable-next-line no-console
    console.error('BACKUP_ENCRYPTION_KEY not set')
    process.exit(1)
  }
  const json = await exportJson()
  const raw = Buffer.from(JSON.stringify(json))
  const enc = encrypt(raw, key)
  const dir = path.resolve('backups')
  const name = `backup-${new Date().toISOString().slice(0,10)}.enc`
  const file = path.join(dir, name)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(file, enc)
  await logger.info('backup created', { file, bytes: enc.length })
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ file, bytes: enc.length }))
}

void main().finally(async () => {
  await prisma.$disconnect()
})
