import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { httpError } from "@/interface/errors/HttpError"
import { ErrorCodes } from "@/interface/errors/error-codes"
import { LineHttpClient } from "@/infrastructure/line/LineHttpClient"
import { registrationRejectedMessage } from "@/infrastructure/line/decisionMessages"

export const runtime = "nodejs"

export const POST = withErrorHandling(async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const session = await requireRole(req, ["ADMIN"])
  const { id } = await ctx.params
  const reg = await prisma.tenantRegistration.findUnique({ where: { id } })
  if (!reg) {
    throw httpError(ErrorCodes.TENANT_NOT_FOUND, "Registration not found")
  }
  if (reg.status !== "PENDING") {
    throw httpError(ErrorCodes.VALIDATION_ERROR, "Invalid state")
  }
  await prisma.tenantRegistration.update({
    where: { id },
    data: { status: "REJECTED", approvedAt: new Date(), approvedBy: session.userId, tenantId: null },
  })
  try {
    await prisma.adminAuditLog.create({
      data: {
        action: "TENANT_REGISTRATION_REJECT",
        adminId: session.userId || "",
        tenantRegistrationId: id,
        tenantId: null,
        lineUserId: reg.lineUserId,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(JSON.stringify({ scope: "audit", action: "create", status: 200, message: msg }))
  }
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (token && reg.lineUserId) {
    const client = new LineHttpClient(token)
    const text = registrationRejectedMessage()
    try {
      await client.pushMessage({ to: reg.lineUserId, messages: [{ type: "text", text }] })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(JSON.stringify({ scope: "line", action: "pushMessage", status: 200, message: msg }))
    }
  }
  return respondOk(req, { id, status: "REJECTED" }, 200)
})
