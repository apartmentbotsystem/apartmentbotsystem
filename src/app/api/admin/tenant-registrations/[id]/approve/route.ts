import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { httpError } from "@/interface/errors/HttpError"
import { ErrorCodes } from "@/interface/errors/error-codes"
import { LineHttpClient } from "@/infrastructure/line/LineHttpClient"
import { registrationApprovedMessage } from "@/infrastructure/line/decisionMessages"

export const runtime = "nodejs"

export const POST = withErrorHandling(async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const session = await requireRole(req, ["ADMIN"])
  const { id } = await ctx.params
  const payload = await req.json().catch(() => ({}))
  const bodyRoomId = typeof payload?.roomId === "string" ? payload.roomId : null
  const reg = await prisma.tenantRegistration.findUnique({ where: { id }, include: { room: true, tenant: true } })
  if (!reg) {
    throw httpError(ErrorCodes.TENANT_NOT_FOUND, "Registration not found")
  }
  if (reg.status !== "PENDING") {
    throw httpError(ErrorCodes.VALIDATION_ERROR, "Invalid state")
  }
  const targetRoomId = bodyRoomId ?? reg.roomId ?? null
  if (!targetRoomId) {
    throw httpError(ErrorCodes.VALIDATION_ERROR, "roomId is required")
  }
  const room = await prisma.room.findUnique({ where: { id: targetRoomId } })
  if (!room || room.status !== "AVAILABLE") {
    throw httpError(ErrorCodes.ROOM_NOT_AVAILABLE, "Room not available")
  }
  let tenantId: string | null = reg.tenantId ?? null
  if (!tenantId) {
    const t = await prisma.tenant.findFirst({ where: { roomId: targetRoomId, role: "PRIMARY" } })
    tenantId = t?.id ?? null
  }
  if (!tenantId) {
    throw httpError(ErrorCodes.TENANT_NOT_FOUND, "Tenant not found")
  }
  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id: tenantId! },
      data: { lineUserId: reg.lineUserId, roomId: targetRoomId },
    })
    await tx.room.update({ where: { id: targetRoomId }, data: { status: "OCCUPIED", tenantId: tenantId! } })
    await tx.tenantRegistration.update({
      where: { id },
      data: { status: "ACTIVE", approvedAt: new Date(), approvedBy: session.userId, tenantId },
    })
  })
  try {
    await prisma.adminAuditLog.create({
      data: {
        action: "TENANT_REGISTRATION_APPROVE",
        adminId: session.userId || "",
        tenantRegistrationId: id,
        tenantId,
        lineUserId: reg.lineUserId,
      },
    })
    await prisma.adminAuditLog.create({
      data: {
        action: "TENANT_ASSIGN_ROOM",
        adminId: session.userId || "",
        tenantRegistrationId: id,
        tenantId,
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
    const text = registrationApprovedMessage(room ? { roomNumber: room.roomNumber } : null)
    try {
      await client.pushMessage({ to: reg.lineUserId, messages: [{ type: "text", text }] })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(JSON.stringify({ scope: "line", action: "pushMessage", status: 200, message: msg }))
    }
  }
  return respondOk(req, { id, status: "ACTIVE" }, 200)
})
