import { getRegistrationState } from "@/infrastructure/registration/registration.service"
import { messageForState } from "@/infrastructure/line/messageTemplates"
import { LineHttpClient } from "@/infrastructure/line/LineHttpClient"
import type { RequestMeta } from "@/interface/http/request-context"
import { logger } from "@/interface/logger/logger"

export async function handleFollow(ev: { replyToken: string; userId: string }, client: LineHttpClient, meta?: RequestMeta): Promise<void> {
  const state = await getRegistrationState(ev.userId)
  const msg = messageForState(state)
  await client.replyMessage({ replyToken: ev.replyToken, messages: [{ type: "text", text: msg }] })
  if (meta) logger.info({ requestId: meta.requestId, method: meta.method, path: meta.path, status: 200 })
}
