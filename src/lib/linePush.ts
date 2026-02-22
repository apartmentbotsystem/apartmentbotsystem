export async function pushMessage(lineUserId: string, message: string) {
  const token = process.env['LINE_CHANNEL_TOKEN'] ?? ''
  if (!token) return
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: 'text', text: message }]
    })
  }).catch(() => {})
}
