import { redirect } from 'next/navigation'

export default function AdminBillingMonthLegacyRedirect({
  params
}: {
  params: { year: string; month: string }
}) {
  const y = encodeURIComponent(params.year)
  const m = encodeURIComponent(params.month)
  redirect(`/billing?year=${y}&month=${m}`)
}

