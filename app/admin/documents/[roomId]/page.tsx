import { prisma } from '@/lib/db'
import { DocumentStatus } from '@prisma/client'
import { sendDocumentVersion, resendDocumentVersion } from '@/services/delivery'
import { revalidatePath } from 'next/cache'

export default async function DocumentsByRoom({ params }: { params: { roomId: string } }) {
  const roomNumber = params.roomId
  const docs = await prisma.documentVersion.findMany({
    where: { roomNumber },
    include: { billingMonth: true },
    orderBy: [{ billingMonthId: 'asc' }, { versionNo: 'asc' }]
  })
  // group by billing month
  const groups: Record<string, typeof docs> = {}
  for (const d of docs) {
    const key = d.billingMonth ? `${d.billingMonth.year}-${String(d.billingMonth.month).padStart(2, '0')}` : 'unknown'
    groups[key] = groups[key] ?? []
    groups[key].push(d)
  }
  return (
    <div style={{ padding: 16 }}>
      <h1>Documents for room {roomNumber}</h1>
      {Object.entries(groups).map(([monthKey, arr]) => {
        // compute billingChanged badge per version by comparing hash with previous in same template group
        const withBadges = arr.map((d, idx) => {
          const sj = d.snapshotJson as unknown as { billingHash?: string; templateGroupId?: string | null } | null
          let billingChanged = false
          if (idx > 0) {
            const prev = arr[idx - 1]
            if (!prev) {
              // unreachable by construction, but satisfies TS strict null checks
            }
            const sjPrev = prev ? (prev.snapshotJson as unknown as { billingHash?: string; templateGroupId?: string | null } | null) : null
            if (sj && sjPrev && sj.templateGroupId && sjPrev.templateGroupId && sj.templateGroupId === sjPrev.templateGroupId) {
              billingChanged = !!(sj.billingHash && sjPrev.billingHash && sj.billingHash !== sjPrev.billingHash)
            }
          }
          return { d, billingChanged }
        })
        return (
          <div key={monthKey} style={{ marginBottom: 24 }}>
            <h2>{monthKey}</h2>
            <ul>
              {withBadges.map(({ d, billingChanged }) => (
                <li key={d.id}>
                  v{d.versionNo} — {d.status}
                  {d.isZeroAmount ? ' [ZERO]' : ''}{billingChanged ? ' [BILLING CHANGED]' : ''}
                  {' '}
                  {(d.status === DocumentStatus.READY || d.status === DocumentStatus.FAILED) ? (
                    <form style={{ display: 'inline' }} action={async () => {
                      'use server'
                      await sendDocumentVersion({ documentVersionId: d.id, actorId: 'admin' })
                      revalidatePath(`/admin/documents/${roomNumber}`)
                    }}>
                      <button type="submit">Enqueue Send</button>
                    </form>
                  ) : null}
                  {' '}
                  {d.status === DocumentStatus.SENT ? (
                    <form style={{ display: 'inline' }} action={async () => {
                      'use server'
                      await resendDocumentVersion(d.id, 'admin')
                      revalidatePath(`/admin/documents/${roomNumber}`)
                    }}>
                      <button type="submit">Enqueue Resend</button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
