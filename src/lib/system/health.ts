import { prisma } from '@/lib/db'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

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
