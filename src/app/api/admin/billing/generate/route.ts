import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk, respondError } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { ValidationError } from "@/interface/errors/ValidationError"

export const runtime = "nodejs"

export const POST = withErrorHandling(async (req: Request): Promise<Response> => {
  const session = await requireRole(req, ["ADMIN"])
  const body = await req.json().catch(() => ({}))
  const period = typeof body?.period === "string" ? body.period : ""
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new ValidationError("Invalid period format, expected YYYY-MM")
  }
  const idemKey = req.headers.get("x-idempotency-key")
  const endpoint = "/api/admin/billing/generate"
  const requestHash = JSON.stringify({ period })
  if (idemKey) {
    const existing = await prisma.idempotencyKey.findFirst({ where: { key: idemKey, endpoint } })
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return respondError(req, "IDEMPOTENCY_KEY_MISMATCH", "Idempotency key reuse with different request", 409)
      }
      return respondOk(req, existing.responseSnapshot as unknown as Record<string, unknown>, 200)
    }
  }
  const tenants = await prisma.tenant.findMany({
    where: { roomId: { not: null } },
    select: { id: true, roomId: true },
    take: 1000,
  })
  let createdCount = 0
  await prisma.$transaction(async (tx) => {
    for (const t of tenants) {
      const exists = await tx.invoice.findFirst({ where: { tenantId: t.id, periodMonth: period } })
      if (exists) continue
      const contract = await tx.contract.findFirst({ where: { tenantId: t.id, roomId: t.roomId ?? undefined, status: "ACTIVE" } })
      const rent = contract?.rent ?? 0
      await tx.invoice.create({
        data: {
          tenantId: t.id,
          roomId: t.roomId!,
          periodMonth: period,
          rentAmount: rent,
          waterAmount: 0,
          electricAmount: 0,
          totalAmount: rent,
          status: "DRAFT",
          issuedAt: new Date(),
          dueDate: new Date(),
          ownerType: "TENANT",
        },
      })
      createdCount += 1
    }
  })
  try {
    await prisma.adminAuditLog.create({
      data: {
        action: "BILLING_GENERATE",
        adminId: session.userId || "",
        tenantRegistrationId: "",
        tenantId: null,
        lineUserId: null,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(JSON.stringify({ scope: "audit", action: "create", status: 200, message: msg, period, count: createdCount }))
  }
  const payload = { period, count: createdCount }
  if (idemKey) {
    try {
      await prisma.idempotencyKey.create({
        data: { key: idemKey, endpoint, requestHash, responseSnapshot: payload },
      })
    } catch {
    }
  }
  return respondOk(req, payload, 200)
})
