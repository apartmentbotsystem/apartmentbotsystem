import { prisma } from '@/lib/db'

export async function getLineAccessTokenPreferDb(): Promise<string> {
  const row = await prisma.systemSetting.findUnique({ where: { key: 'settings:environment' }, select: { value: true } })
  const val = row && row.value && typeof row.value === 'object' && !Array.isArray(row.value) ? (row.value as Record<string, unknown>) : {}
  const fromDb = typeof val.lineChannelToken === 'string' && val.lineChannelToken.trim() ? val.lineChannelToken.trim() : ''
  const fromEnv = process.env['LINE_CHANNEL_TOKEN'] ?? process.env['LINE_CHANNEL_ACCESS_TOKEN'] ?? ''
  const token = fromDb || fromEnv
  if (!token) throw new Error('LINE channel access token missing at runtime')
  return token
}

export async function getLineSecretPreferDb(): Promise<string> {
  const row = await prisma.systemSetting.findUnique({ where: { key: 'settings:environment' }, select: { value: true } })
  const val = row && row.value && typeof row.value === 'object' && !Array.isArray(row.value) ? (row.value as Record<string, unknown>) : {}
  const fromDb = typeof val.lineSecret === 'string' && val.lineSecret.trim() ? val.lineSecret.trim() : ''
  const fromEnv = process.env['LINE_CHANNEL_SECRET'] ?? ''
  const secret = fromDb || fromEnv
  if (!secret) throw new Error('LINE channel secret missing at runtime')
  return secret
}

export function getServerConfig() {
  if (typeof window !== 'undefined') {
    throw new Error('getServerConfig() must not run on client')
  }
  const LINE_CHANNEL_TOKEN = process.env['LINE_CHANNEL_TOKEN'] ?? process.env['LINE_CHANNEL_ACCESS_TOKEN'] ?? ''
  const { DATABASE_URL } = process.env
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL missing at runtime')
  }
  return { LINE_CHANNEL_TOKEN, DATABASE_URL }
}

export function getExpectedWebhookEndpoint(): string | null {
  const site = process.env['SITE_URL'] || process.env['PUBLIC_BASE_URL'] || process.env['NEXTAUTH_URL'] || ''
  if (!site) return null
  const u = site.endsWith('/') ? site.slice(0, -1) : site
  return `${u}/api/line/webhook`
}
