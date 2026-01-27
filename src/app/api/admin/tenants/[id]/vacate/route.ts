import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { httpError } from "@/interface/errors/HttpError"
import { ErrorCodes } from "@/interface/errors/error-codes"
import { LineHttpClient } from "@/infrastructure/line/LineHttpClient"

export const runtime = "nodejs"

export const POST = withErrorHandling(async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const session = await requireRole(req, ["ADMIN"])
  const { id } = await ctx.params
  const tenant = await prisma.tenant.findUnique({ where: { id } })
  if (!tenant) {
    throw httpError(ErrorCodes.TENANT_NOT_FOUND, "Tenant not found")
  }
  if (!tenant.roomId) {
    throw httpError(ErrorCodes.TENANT_NOT_IN_ROOM, "Tenant not in room")
  }
  const room = await prisma.room.findUnique({ where: { id: tenant.roomId } })
  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({ where: { id }, data: { roomId: null } })
    if (room) {
      await tx.room.update({ where: { id: room.id }, data: { tenantId: null, status: "AVAILABLE" } })
    }
  })
  try {
    await prisma.adminAuditLog.create({
      data: {
        action: "TENANT_VACATE",
        adminId: session.userId || "",
        tenantRegistrationId: "",
        tenantId: id,
        lineUserId: tenant.lineUserId ?? null,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(JSON.stringify({ scope: "audit", action: "create", status: 200, message: msg }))
  }
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (token && tenant.lineUserId) {
    const client = new LineHttpClient(token)
    const text = "การย้ายออกของคุณเสร็จสมบูรณ์ ขอบคุณที่ใช้บริการ"
    try {
      await client.pushMessage({ to: tenant.lineUserId, messages: [{ type: "text", text }] })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(JSON.stringify({ scope: "line", action: "pushMessage", status: 200, message: msg }))
    }
  }
  return respondOk(req, { id, status: "VACATED" }, 200)
})
