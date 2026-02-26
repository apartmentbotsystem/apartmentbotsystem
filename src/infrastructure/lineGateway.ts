export type LineSendPayload = {
  roomNumber: string
  text: string
}

export type LineGateway = {
  sendLineMessage(payload: LineSendPayload): Promise<{ messageId: string }>
}

function getLineToken(): string {
  const token = process.env['LINE_CHANNEL_TOKEN'] ?? process.env['LINE_CHANNEL_ACCESS_TOKEN'] ?? ''
  if (!token) throw new Error('LINE token not configured')
  return token
}

async function defaultSend(payload: LineSendPayload): Promise<{ messageId: string }> {
  const token = getLineToken()
  const to = payload.roomNumber
  if (!to) throw new Error('LINE target missing')
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      to,
      messages: [{ type: 'text', text: payload.text }]
    })
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`LINE_PUSH_FAILED:${res.status}:${body}`)
  }
  return { messageId: `push:${Date.now()}` }
}

let current: LineGateway = {
  sendLineMessage: defaultSend
}

export function setLineGateway(gateway: LineGateway) {
  current = gateway
}

export async function sendLineMessage(payload: LineSendPayload) {
  return current.sendLineMessage(payload)
}
