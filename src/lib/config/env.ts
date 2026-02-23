export function getLineAccessToken(): string {
  const token = process.env['LINE_CHANNEL_TOKEN'] ?? process.env['LINE_CHANNEL_ACCESS_TOKEN'] ?? ''
  if (!token) throw new Error('LINE channel access token missing at runtime')
  return token
}

export function getServerConfig() {
  if (typeof window !== 'undefined') {
    throw new Error('getServerConfig() must not run on client')
  }
  const LINE_CHANNEL_TOKEN = getLineAccessToken()
  const { DATABASE_URL } = process.env
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL missing at runtime')
  }
  return { LINE_CHANNEL_TOKEN, DATABASE_URL }
}
