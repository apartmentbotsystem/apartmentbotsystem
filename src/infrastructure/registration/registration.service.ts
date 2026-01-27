import { prisma } from "@/infrastructure/db/prisma/prismaClient"

export type RegistrationState = "NONE" | "PENDING" | "ACTIVE" | "REJECTED"

export async function getRegistrationState(lineUserId: string): Promise<RegistrationState> {
  const tenant = await prisma.tenant.findFirst({ where: { lineUserId } })
  if (tenant) return "ACTIVE"
  const reg = await prisma.tenantRegistration.findUnique({ where: { lineUserId } })
  if (!reg) return "NONE"
  if (reg.status === "PENDING") return "PENDING"
  if (reg.status === "ACTIVE") return "ACTIVE"
  return "REJECTED"
}

export async function triggerRegistration(lineUserId: string): Promise<RegistrationState> {
  const tenant = await prisma.tenant.findFirst({ where: { lineUserId } })
  if (tenant) return "ACTIVE"
  const reg = await prisma.tenantRegistration.findUnique({ where: { lineUserId } })
  if (!reg) {
    await prisma.tenantRegistration.create({
      data: { lineUserId, status: "PENDING" },
    })
    return "PENDING"
  }
  if (reg.status === "PENDING") return "PENDING"
  if (reg.status === "ACTIVE") return "ACTIVE"
  await prisma.tenantRegistration.update({
    where: { lineUserId },
    data: { status: "PENDING", approvedAt: null, approvedBy: null, tenantId: null, roomId: reg.roomId ?? null },
  })
  return "PENDING"
}
