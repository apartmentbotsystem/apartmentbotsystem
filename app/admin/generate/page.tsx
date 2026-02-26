import { redirect } from 'next/navigation'

export default function AdminGenerateLegacyRedirect() {
  redirect('/admin/documents/generate')
}

