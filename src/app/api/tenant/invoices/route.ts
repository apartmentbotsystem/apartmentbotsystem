import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import type { TenantInvoicesDTO } from "@/application/dto/tenant-invoices.dto"

export const runtime = "nodejs"

const FRESHNESS_THRESHOLD_MS = 15 * 60 * 1000

function isStale(calculatedAt: Date): boolean {
  const now = new Date()
  return now.getTime() - calculatedAt.getTime() > FRESHNESS_THRESHOLD_MS
}

function monthsBack(count: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, "0")
    out.push(`${y}-${m}`)
  }
  return out
}

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  const session = await requireRole(req, ["TENANT"])
  const calculatedAt = new Date()
  const tenantId = session.userId || null
  let resolvedTenantId = tenantId
  if (resolvedTenantId) {
    const t = await prisma.tenant.findUnique({ where: { id: resolvedTenantId }, select: { id: true } })
    if (!t) {
      const byLine = await prisma.tenant.findFirst({ where: { lineUserId: resolvedTenantId }, select: { id: true } })
      resolvedTenantId = byLine?.id || null
    }
  }
  const months = monthsBack(6)
  let items: TenantInvoicesDTO["items"] = []
  if (resolvedTenantId) {
    const invoices = await prisma.invoice.findMany({
      where: { tenantId: resolvedTenantId, periodMonth: { in: months } },
      orderBy: { periodMonth: "desc" },
      select: { id: true, periodMonth: true, totalAmount: true, status: true },
      take: 100,
    })
    const paymentsByInvoice: Record<string, Array<{ paymentId: string; paidAt: string; amount: number }>> = {}
    if (invoices.length > 0) {
      const payments = await prisma.payment.findMany({
        where: { invoiceId: { in: invoices.map((i) => i.id) } },
        select: { id: true, invoiceId: true, paidAt: true, amount: true },
        orderBy: { paidAt: "desc" },
        take: 500,
      })
      for (const p of payments) {
        const arr = paymentsByInvoice[p.invoiceId] || []
        arr.push({ paymentId: String(p.id), paidAt: p.paidAt instanceof Date ? p.paidAt.toISOString() : "", amount: Number(p.amount || 0) })
        paymentsByInvoice[p.invoiceId] = arr
      }
    }
    items = invoices.map((inv) => ({
      month: inv.periodMonth,
      amount: Number(inv.totalAmount || 0),
      status: String(inv.status) === "PAID" ? "PAID" : "UNPAID",
      invoiceId: String(inv.id),
      payments: paymentsByInvoice[inv.id] || undefined,
    }))
  }
  const freshnessMs = Math.max(0, new Date().getTime() - calculatedAt.getTime())
  const missingMonths = months.filter((m) => !items.find((it) => it.month === m))
  const status: TenantInvoicesDTO["meta"]["status"] = missingMonths.length > 0 ? "PARTIAL" : isStale(calculatedAt) ? "STALE" : "OK"
  const reason = missingMonths.length > 0 ? "missing months" : undefined
  const payload: TenantInvoicesDTO = {
    items,
    meta: { status, calculatedAt: calculatedAt.toISOString(), freshnessMs, reason },
  }
  return respondOk<TenantInvoicesDTO>(req, payload, 200)
})
