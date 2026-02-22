import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'

function getEnv(name: string): string {
  const v = process.env[name]
  if (v && v.trim()) return v
  throw new Error(`Missing required env: ${name}`)
}

async function main(): Promise<void> {
  const DATABASE_URL = getEnv('DATABASE_URL')
  const arg = process.argv[2]
  if (!arg) {
    throw new Error('Usage: tsx scripts/restore.ts <backup-file-path>')
  }
  const file = path.resolve(process.cwd(), arg)
  await fs.access(file)
  console.log(`Restoring from ${file}`)
  await new Promise<void>((resolve, reject) => {
    const args = ['-d', DATABASE_URL, '-f', file]
    const child = spawn('psql', args, { stdio: 'inherit' })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`psql exited with code ${code}`))
    })
    child.on('error', (err) => reject(err))
  })
  console.log('Restore completed')
}

main().catch((err) => {
  console.error('Restore failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})

