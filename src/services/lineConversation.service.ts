import { prisma } from '@/lib/db'
import { logAudit } from '@/services/audit'

export type ConversationState = 'WAITING_ROOM' | 'WAITING_NAME' | 'WAITING_PHONE'

type PartialData = {
  tempRoom?: string
  tempName?: string
  tempPhone?: string
}

export async function getState(lineUserId: string) {
  const s = await prisma.lineConversationState.findUnique({ where: { lineUserId } })
  if (!s) return null
  return {
    state: s.state as ConversationState,
    tempRoom: s.tempRoom ?? undefined,
    tempName: s.tempName ?? undefined,
    tempPhone: s.tempPhone ?? undefined
  }
}

export async function setState(lineUserId: string, state: ConversationState, partialData?: PartialData) {
  await prisma.lineConversationState.upsert({
    where: { lineUserId },
    create: {
      lineUserId,
      state,
      tempRoom: partialData?.tempRoom ?? null,
      tempName: partialData?.tempName ?? null,
      tempPhone: partialData?.tempPhone ?? null
    },
    update: {
      state,
      ...(partialData?.tempRoom !== undefined ? { tempRoom: partialData.tempRoom } : {}),
      ...(partialData?.tempName !== undefined ? { tempName: partialData.tempName } : {}),
      ...(partialData?.tempPhone !== undefined ? { tempPhone: partialData.tempPhone } : {})
    }
  })
  await logAudit({ actorId: 'system', action: 'LINE_STATE_SET', entity: 'LineConversation', entityId: lineUserId, metadata: { state, ...partialData } })
}

export async function clearState(lineUserId: string) {
  await prisma.lineConversationState.deleteMany({ where: { lineUserId } })
  await logAudit({ actorId: 'system', action: 'LINE_STATE_CLEAR', entity: 'LineConversation', entityId: lineUserId })
}
