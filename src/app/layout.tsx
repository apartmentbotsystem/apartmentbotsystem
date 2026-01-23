import "./globals.css"
import Link from "next/link"
import { cookies } from "next/headers"
import { verifySession } from "@/lib/auth.config"

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies()
  const raw = store.get("app_session")?.value
  const claims = raw ? await verifySession(raw) : null
  const roleLabel = claims?.role
  const canCreate = roleLabel === "ADMIN"
  return (
    <html lang="th">
      <body>
        <div className="min-h-screen flex">
          <aside className="w-52 bg-slate-900 text-white p-4 space-y-3">
            <div className="text-lg font-semibold">Apartment Admin</div>
            <nav className="flex flex-col space-y-2">
              <Link href="/dashboard" className="hover:underline">
                Dashboard
              </Link>
              <Link href="/invoices" className="hover:underline">
                Invoices
              </Link>
              <Link href="/payments" className="hover:underline">
                Payments
              </Link>
              <Link href="/tenants" className="hover:underline">
                Tenants
              </Link>
              <Link href="/activity" className="hover:underline">
                Activity Log
              </Link>
              <form action="/api/auth/logout" method="post">
                <button className="rounded bg-slate-700 px-3 py-1 hover:bg-slate-600">Logout</button>
              </form>
            </nav>
          </aside>
          <main className="flex-1">
            <div className="border-b bg-white">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="ค้นหา Invoice ID"
                    className="border rounded px-2 py-1"
                    aria-label="ค้นหา Invoice ID"
                  />
                  {canCreate && (
                    <Link href="/invoices" className="rounded bg-slate-800 px-3 py-1 text-white">
                      Create Invoice
                    </Link>
                  )}
                </div>
                <div className="text-sm text-slate-600">{roleLabel ? `Role: ${roleLabel}` : "Guest"}</div>
              </div>
            </div>
            <div className="p-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  )
}
