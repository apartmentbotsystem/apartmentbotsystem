import fs from 'node:fs'
import path from 'node:path'

const apiRoot = path.resolve('app', 'api')
const allowPatterns = [
  /^health(\/|$)/,
  /^system\/health(\/|$)/,
  /^line\/webhook(\/|$)/,
  /^webhook(\/|$)/,
  /^auth\/login(\/|$)/,
  /^auth\/logout(\/|$)/,
  /^logs\/client(\/|$)/
]

function isAllowlisted(rel: string) {
  const p = rel.replace(/\\/g, '/').replace(/^api\//, '')
  return allowPatterns.some(rx => rx.test(p))
}

function* walk(dir: string): Generator<string> {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else if (e.isFile() && e.name === 'route.ts') yield p
  }
}

function main() {
  const missing: string[] = []
  const scanned: string[] = []
  for (const file of walk(apiRoot)) {
    const rel = path.relative(path.join(process.cwd(), 'app'), file).replace(/\\/g, '/')
    const routeRel = rel.replace(/^api\//, '')
    const content = fs.readFileSync(file, 'utf8')
    if (isAllowlisted(routeRel)) continue
    scanned.push('/api/' + routeRel.replace(/\/route\.ts$/, ''))
    if (!content.includes('requireSession(')) {
      missing.push('/api/' + routeRel.replace(/\/route\.ts$/, ''))
    }
  }
  if (missing.length) {
    console.error('Protected route scanner FAIL')
    console.error('Missing requireSession in routes:')
    for (const r of missing) console.error(' -', r)
    process.exit(1)
  }
  console.log('Protected route scanner PASS')
  console.log('Scanned routes:')
  for (const r of scanned) console.log(' -', r)
}

main()
