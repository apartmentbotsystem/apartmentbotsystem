import { redirect } from 'next/navigation'

export default function AdminMessageByIdLegacyRedirect({
  params
}: {
  params: { id: string }
}) {
  redirect(`/line?id=${encodeURIComponent(params.id)}`)
}

