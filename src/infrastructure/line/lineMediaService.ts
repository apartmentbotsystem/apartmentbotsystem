export async function headMediaSize(_messageId: string): Promise<number | null> {
  return null
}

export async function fetchMediaContent(_messageId: string): Promise<{ contentType: string; buffer: Buffer }> {
  return { contentType: 'application/octet-stream', buffer: Buffer.alloc(0) }
}
