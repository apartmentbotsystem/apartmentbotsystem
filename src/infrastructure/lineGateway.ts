export type LineSendPayload = {
  roomNumber: string
  text: string
}

export type LineGateway = {
  sendLineMessage(payload: LineSendPayload): Promise<{ messageId: string }>
}

let current: LineGateway = {
  async sendLineMessage() {
    throw new Error('LINE gateway not configured')
  }
}

export function setLineGateway(gateway: LineGateway) {
  current = gateway
}

export async function sendLineMessage(payload: LineSendPayload) {
  return current.sendLineMessage(payload)
}
