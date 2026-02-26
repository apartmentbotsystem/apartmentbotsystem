export async function uploadBuffer(_bucket: string, path: string, _buffer: ArrayBuffer | Uint8Array | Buffer, _contentType: string): Promise<{ path: string }> {
  return { path }
}

export async function createSignedUrl(_bucket: string, path: string, _expiresSeconds: number): Promise<string> {
  return `/${path}`
}
