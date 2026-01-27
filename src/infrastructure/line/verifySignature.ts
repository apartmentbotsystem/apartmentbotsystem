import crypto from "node:crypto"

export function verifyLineSignature(signature: string | null, body: string, channelSecret: string | undefined): boolean {
  if (!signature || !channelSecret) return false
  const hmac = crypto.createHmac("sha256", channelSecret)
  hmac.update(body)
  const digest = hmac.digest("base64")
  const a = Buffer.from(signature)
  const b = Buffer.from(digest)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
