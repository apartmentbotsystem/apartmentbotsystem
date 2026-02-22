export function getServerConfig() {
  if (typeof window !== 'undefined') {
    throw new Error('getServerConfig() must not run on client')
  }
  const { LINE_CHANNEL_TOKEN, DATABASE_URL } = process.env
  if (!LINE_CHANNEL_TOKEN) {
    throw new Error('LINE_CHANNEL_TOKEN missing at runtime')
  }
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL missing at runtime')
  }
  return { LINE_CHANNEL_TOKEN, DATABASE_URL }
}
