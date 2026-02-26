export async function getFatalStateDetail(): Promise<{ fatal: boolean; reason?: string }> {
  return { fatal: false }
}
