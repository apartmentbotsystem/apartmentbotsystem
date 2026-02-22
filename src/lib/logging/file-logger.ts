import { promises as fs } from 'node:fs'
import path from 'node:path'

type Level = 'info' | 'warn' | 'error'

const LOG_DIR = process.env['LOG_DIR'] ?? path.resolve(process.cwd(), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'app.log')
const MAX_BYTES = 10 * 1024 * 1024

async function ensureDir(): Promise<void> {
  await fs.mkdir(LOG_DIR, { recursive: true })
}

async function rotateIfNeeded(): Promise<void> {
  try {
    const st = await fs.stat(LOG_FILE)
    if (st.size > MAX_BYTES) {
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      const rotated = path.join(LOG_DIR, `app-${ts}.log`)
      await fs.rename(LOG_FILE, rotated)
    }
  } catch {
    // no file, ignore
  }
}

function formatLine(level: Level, message: string, meta?: Record<string, unknown>): string {
  const ts = new Date().toISOString()
  const base = `[${ts}] [${level.toUpperCase()}] ${message}`
  if (!meta) return base + '\n'
  const tail = JSON.stringify(meta)
  return `${base} ${tail}\n`
}

async function write(line: string): Promise<void> {
  await ensureDir()
  await rotateIfNeeded()
  await fs.appendFile(LOG_FILE, line, { encoding: 'utf8' })
}

export const logger = {
  async info(message: string, meta?: Record<string, unknown>): Promise<void> {
    await write(formatLine('info', message, meta))
  },
  async warn(message: string, meta?: Record<string, unknown>): Promise<void> {
    await write(formatLine('warn', message, meta))
  },
  async error(message: string, meta?: Record<string, unknown>): Promise<void> {
    await write(formatLine('error', message, meta))
  }
}

