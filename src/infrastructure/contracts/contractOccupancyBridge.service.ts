import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import { domainTransaction } from "@/infrastructure/db/domainTransaction"
import { createMoveIn, createMoveOut } from "@/infrastructure/occupancy/occupancy.service"
import { emitAuditEvent } from "@/infrastructure/audit/audit.service"

export async function onContractActivated(contractId: string): Promise<void> {
  await domainTransaction(async () => {
    const contract = await prisma.contract.findUnique({ where: { id: contractId } })
    if (!contract) throw new Error("Contract not found")
    await createMoveIn(contract.roomId, contract.tenantId, contract.startDate, "SYSTEM")
    await emitAuditEvent({
      actorType: "SYSTEM",
      action: "CONTRACT_ACTIVATED_MOVE_IN",
      targetType: "CONTRACT",
      targetId: contractId,
      severity: "INFO",
      metadata: { roomId: contract.roomId, tenantId: contract.tenantId, startDate: contract.startDate.toISOString() },
    })
  })
}

export async function onContractClosed(contractId: string): Promise<void> {
  await domainTransaction(async () => {
    const contract = await prisma.contract.findUnique({ where: { id: contractId } })
    if (!contract) throw new Error("Contract not found")
    const end = contract.endDate ?? new Date()
    await createMoveOut(contract.roomId, contract.tenantId, end, "SYSTEM")
    await emitAuditEvent({
      actorType: "SYSTEM",
      action: "CONTRACT_CLOSED_MOVE_OUT",
      targetType: "CONTRACT",
      targetId: contractId,
      severity: "INFO",
      metadata: { roomId: contract.roomId, tenantId: contract.tenantId, endDate: end.toISOString() },
    })
  })
}
