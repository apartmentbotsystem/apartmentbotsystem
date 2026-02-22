// Edge-safe JWT verification for middleware (no Node crypto, no DB)
export type EdgeUser = { id: string; role: string } | null

function b64urlToUint8Array(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function verifyHS256Edge(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const h = parts[0] ?? ''
  const p = parts[1] ?? ''
  const s = parts[2] ?? ''
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  const sigSrc = b64urlToUint8Array(s)
  // Copy into a fresh ArrayBuffer to avoid SharedArrayBuffer typing
  const sigBytes = new Uint8Array(sigSrc.length)
  sigBytes.set(sigSrc)
  const msgBytes = new TextEncoder().encode(`${h}.${p}`)
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    msgBytes
  )
  if (!valid) return null
  try {
    const json = atob((p + '==='.slice((p.length + 3) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json) as Record<string, unknown>
    const exp = typeof payload['exp'] === 'number' ? payload['exp'] as number : 0
    if (!exp || Date.now() / 1000 >= exp) return null
    return payload
  } catch {
    return null
  }
}

export async function getUserFromRequestEdge(req: Request): Promise<EdgeUser> {
  const secret = process.env['AUTH_SECRET']
  if (!secret) return null
  const cookie = req.headers.get('cookie') ?? ''
  const m = cookie.match(/(?:^|;\s*)session=([^;]+)/)
  if (!m) return null
  const token = decodeURIComponent(m[1] ?? '')
  const payload = await verifyHS256Edge(token, secret)
  if (!payload) return null
  const sub = String(payload['sub'] ?? '')
  const role = String(payload['role'] ?? '')
  if (!sub || !role) return null
  return { id: sub, role }
}
