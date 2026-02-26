export async function enqueueDocumentSend(_: { documentVersionId: string; roomNumber: string; billingMonthId: string | null }): Promise<{ status: 'QUEUED' | 'FAILED' | 'SUCCESS' }> {
  return { status: 'QUEUED' }
}
