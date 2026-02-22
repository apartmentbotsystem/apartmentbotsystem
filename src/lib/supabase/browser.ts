import { createBrowserClient } from '@supabase/ssr'

export function getSupabaseBrowser() {
  if (typeof window === 'undefined') {
    throw new Error('getSupabaseBrowser() must be called on the client')
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    // Avoid throwing during build/SSR; surface at runtime client only
    throw new Error('@supabase/ssr: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing')
  }
  return createBrowserClient(url, anon)
}
