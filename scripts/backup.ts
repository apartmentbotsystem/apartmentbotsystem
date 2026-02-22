import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'

function getEnv(name: string, fallback?: string): string {
  const v = process.env[name]
  if (v && v.trim()) return v
  if (fallback !== undefined) return fallback
  throw new Error(`Missing required env: ${name}`)
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

function timestamp(): string {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
}

async function rotate(dir: string, days: number): Promise<void> {
  const now = Date.now()
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    if (!e.isFile()) continue
    const p = path.join(dir, e.name)
    try {
      const st = await fs.stat(p)
      const ageDays = (now - st.mtimeMs) / (1000 * 60 * 60 * 24)
      if (ageDays > days) {
        await fs.unlink(p)
      }
    } catch {
      // ignore
    }
  }
}

async function main(): Promise<void> {
  const DATABASE_URL = getEnv('DATABASE_URL')
  const BACKUP_DIR = getEnv('BACKUP_DIR', path.resolve(process.cwd(), 'backups'))
  await ensureDir(BACKUP_DIR)
  await rotate(BACKUP_DIR, 14)
  const file = path.join(BACKUP_DIR, `backup-${timestamp()}.sql`)
  console.log(`Creating backup at ${file}`)
  await new Promise<void>((resolve, reject) => {
    const args = ['--no-owner', '--no-privileges', '-f', file, DATABASE_URL]
    const child = spawn('pg_dump', args, { stdio: 'inherit' })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`pg_dump exited with code ${code}`))
    })
    child.on('error', (err) => reject(err))
  })
  console.log('Backup completed')
}

main().catch((err) => {
  console.error('Backup failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})

