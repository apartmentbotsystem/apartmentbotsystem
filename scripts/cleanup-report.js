#!/usr/bin/env node
// cleanup-report.js — Remove report folder and optionally uninstall dev dependencies

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPORT_DIR = path.resolve(process.cwd(), 'report')

function removeDirectory(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
    console.log(`✓ Removed ${dir}`)
  } else {
    console.log(`✗ Directory not found: ${dir}`)
  }
}

function uninstallPackages() {
  const packages = ['@mermaid-js/mermaid-cli', 'docx', 'marked']
  console.log(`\nUninstalling dev packages: ${packages.join(', ')}`)
  try {
    execSync(`npm uninstall ${packages.join(' ')}`, { stdio: 'inherit' })
    console.log('✓ Packages uninstalled')
  } catch (err) {
    console.error('✗ Error uninstalling packages:', err.message)
  }
}

function main() {
  const args = process.argv.slice(2)
  
  console.log('Cleaning up report...')
  removeDirectory(REPORT_DIR)
  
  if (args.includes('--packages')) {
    uninstallPackages()
  } else {
    console.log('\nTo also uninstall dev packages, run:')
    console.log('  node scripts/cleanup-report.js --packages')
  }
  
  console.log('\n✓ Cleanup complete')
}

main()
