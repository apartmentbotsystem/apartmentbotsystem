import "./globals.css"
import Link from "next/link"

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
                  <Link href="/invoices" className="rounded bg-slate-800 px-3 py-1 text-white">
                    Create Invoice
                  </Link>
                </div>
                <div />
              </div>
            </div>
            <div className="p-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  )
}
