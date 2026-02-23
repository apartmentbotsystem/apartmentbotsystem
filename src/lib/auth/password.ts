import crypto from 'crypto'

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LEN = 64

function timingSafeEqualHex(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, 'hex')
  const b = Buffer.from(bHex, 'hex')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export function hashPassword(plain: string): string {
  const password = String(plain ?? '')
  if (!password) throw new Error('Password is required')
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P
  }).toString('hex')
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${derived}`
}

export function verifyPassword(plain: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !plain) return false
  const parts = storedHash.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const n = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  const salt = parts[4] ?? ''
  const expected = parts[5] ?? ''
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p) || !salt || !expected) return false
  const actual = crypto.scryptSync(plain, salt, KEY_LEN, { N: n, r, p }).toString('hex')
  return timingSafeEqualHex(actual, expected)
}

