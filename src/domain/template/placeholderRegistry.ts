import { DomainError } from '@/domain/errors'
import type { TemplateType } from '@prisma/client'

const registry: Record<TemplateType, Set<string>> = {
  BILLING: new Set([
    'room.number',
    'tenant.name',
    'billing.month',
    'billing.total',
    'billing.water',
    'billing.electric'
  ]),
  RECEIPT: new Set([
    'room.number',
    'tenant.name',
    'billing.month',
    'receipt.total'
  ]),
  NOTICE: new Set([
    'room.number',
    'tenant.name',
    'notice.message'
  ]),
  OTHER: new Set<string>([])
}

export function getAllowedPlaceholders(templateType: TemplateType): string[] {
  const allowed = registry[templateType]
  if (!allowed) return []
  return [...allowed].sort()
}

function collectPlaceholders(node: unknown, out: Set<string>) {
  if (node === null || node === undefined) return
  const t = typeof node
  if (t === 'string' || t === 'number' || t === 'boolean') {
    return
  }
  if (Array.isArray(node)) {
    for (const n of node) collectPlaceholders(n, out)
    return
  }
  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>
    const ph = obj['placeholder']
    if (typeof ph === 'string') {
      out.add(ph)
    }
    for (const v of Object.values(obj)) {
      collectPlaceholders(v, out)
    }
  }
}

export function validateTemplateContent(templateType: TemplateType, contentJson: unknown) {
  const allowed = registry[templateType]
  if (!allowed) throw new DomainError('INVALID_TEMPLATE_TYPE', 'Unknown template type', 400)
  const found = new Set<string>()
  collectPlaceholders(contentJson, found)
  for (const key of found) {
    if (!allowed.has(key)) {
      throw new DomainError('INVALID_PLACEHOLDER', `Placeholder not allowed: ${key}`, 422)
    }
  }
}
