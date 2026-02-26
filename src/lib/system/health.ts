import { prisma } from '@/lib/db'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { getLineAccessTokenPreferDb } from '@/lib/config/env'
import os from 'node:os'
import { promises as fsp } from 'node:fs'

export async function checkDatabaseConnection(): Promise<'connected' | 'disconnected'> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return 'connected'
  } catch {
    return 'disconnected'
  }
}

export async function checkDiskWriteAccess(): Promise<boolean> {
  const dir = os.tmpdir()
  const file = path.join(dir, `apartment-erp-health-${Date.now()}.tmp`)
  try {
    await fs.writeFile(file, 'ok', { encoding: 'utf8' })
    await fs.unlink(file)
    return true
  } catch {
    return false
  }
}

export async function getBackupFreshness(): Promise<'fresh' | 'stale' | 'missing'> {
  const BACKUP_DIR = process.env['BACKUP_DIR'] ?? path.resolve(process.cwd(), 'backups')
  try {
    const entries = await fs.readdir(BACKUP_DIR, { withFileTypes: true })
    const files = entries.filter(e => e.isFile())
    if (!files.length) return 'missing'
    let latest = 0
    for (const f of files) {
      const p = path.join(BACKUP_DIR, f.name)
      const st = await fs.stat(p)
      if (st.mtimeMs > latest) latest = st.mtimeMs
    }
    const ageMs = Date.now() - latest
    return ageMs < 24 * 60 * 60 * 1000 ? 'fresh' : 'stale'
  } catch {
    return 'missing'
  }
}

export async function getLogDirectorySizeBytes(): Promise<number> {
  const LOG_DIR = process.env['LOG_DIR'] ?? path.join(os.tmpdir(), 'apartment-erp-logs')
  async function walk(dir: string): Promise<number> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      let total = 0
      for (const e of entries) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) {
          total += await walk(p)
        } else if (e.isFile()) {
          const st = await fs.stat(p)
          total += st.size
        }
      }
      return total
    } catch {
      return 0
    }
  }
  return walk(LOG_DIR)
}

export async function checkMemory(): Promise<{ heapUsed: number; rss: number; status: 'ok' | 'high' | 'critical' }> {
  const { heapUsed, rss } = process.memoryUsage()
  const status = heapUsed > 1.5 * 1024 * 1024 * 1024 ? 'critical' : heapUsed > 1.0 * 1024 * 1024 * 1024 ? 'high' : 'ok'
  return { heapUsed, rss, status }
}

export async function checkDisk(): Promise<{ writable: boolean; logsBytes: number; status: 'ok' | 'degraded' | 'full' }> {
  const writable = await checkDiskWriteAccess()
  const logsBytes = await getLogDirectorySizeBytes()
  const status = !writable ? 'full' : logsBytes > 500 * 1024 * 1024 ? 'degraded' : 'ok'
  return { writable, logsBytes, status }
}

export async function checkLineApi(): Promise<'ok' | 'unconfigured' | 'fail'> {
  let token: string = ''
  try {
    token = await getLineAccessTokenPreferDb()
  } catch {
    return 'unconfigured'
  }
  try {
    const res = await fetch('https://api.line.me/v2/bot/info', {
      headers: { 'Authorization': `Bearer ${token}` },
      method: 'GET',
      cache: 'no-store'
    })
    return res.ok ? 'ok' : 'fail'
  } catch {
    return 'fail'
  }
}

export function getCpuLoadPercent(): number {
  const loads = os.loadavg?.() ?? [0, 0, 0]
  const cores = os.cpus?.()?.length ?? 1
  if (!cores || !loads || loads[0] === 0) return 0
  const pct = Math.max(0, Math.min(100, Math.round((loads[0] / cores) * 100)))
  return pct
}

export async function clearOldLogs(maxAgeDays = 7): Promise<{ removed: number }> {
  const LOG_DIR = process.env['LOG_DIR'] ?? path.join(os.tmpdir(), 'apartment-erp-logs')
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
  let removed = 0
  try {
    const entries = await fsp.readdir(LOG_DIR, { withFileTypes: true })
    for (const e of entries) {
      if (!e.isFile()) continue
      const p = path.join(LOG_DIR, e.name)
      const st = await fsp.stat(p)
      if (st.mtimeMs < cutoff) {
        await fsp.unlink(p).catch(() => {})
        removed++
      }
    }
  } catch {
    // ignore
  }
  return { removed }
}
