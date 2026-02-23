import crypto from 'node:crypto'

export type DocumentSnapshotMeta = {
  templateGroupId: string | null
  billingVersionId: string | null
  billingHash: string | null
}

function stableStringify(value: unknown): string {
  const seen = new WeakSet()
  const walk = (node: unknown): unknown => {
    if (node === null || typeof node !== 'object') return node
    if (seen.has(node as object)) return '[Circular]'
    seen.add(node as object)
    if (Array.isArray(node)) return node.map(walk)
    const out: Record<string, unknown> = {}
    const obj = node as Record<string, unknown>
    for (const key of Object.keys(obj).sort()) out[key] = walk(obj[key])
    return out
  }
  return JSON.stringify(walk(value))
}

export function hashBillingSnapshot(snapshotData: unknown, totalAmount: number): string {
  const payload = { snapshotData, totalAmount }
  return crypto.createHash('sha256').update(stableStringify(payload)).digest('hex')
}

export function readDocumentSnapshotMeta(snapshotJson: unknown): DocumentSnapshotMeta {
  if (!snapshotJson || typeof snapshotJson !== 'object') {
    return { templateGroupId: null, billingVersionId: null, billingHash: null }
  }
  const raw = snapshotJson as Record<string, unknown>
  const templateGroupId = typeof raw.templateGroupId === 'string' ? raw.templateGroupId : null
  const billingVersionId = typeof raw.billingVersionId === 'string' ? raw.billingVersionId : null
  const billingHash = typeof raw.billingHash === 'string' ? raw.billingHash : null
  return { templateGroupId, billingVersionId, billingHash }
}
