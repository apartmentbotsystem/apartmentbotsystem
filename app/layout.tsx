import './globals.css'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { ReactNode } from 'react'
import Link from 'next/link'
import { headers } from 'next/headers'
import ToastProvider from '@/components/ui/ToastProvider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { getActiveMonth, getActiveBuildingId, getActiveFloor, getContextOptions } from '@/lib/context'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth/require-session'
import { setActiveContext } from './context-actions'
import TopContextForm from './top-context-form'
import GlobalCommandK from '@/components/ui/GlobalCommandK'
import NotificationBell from '@/components/ui/NotificationBell'
import ContextFilters from '@/components/ui/ContextFilters'
import DevConsoleFilter from '@/components/dev/DevConsoleFilter'
import ErrorBoundary from '@/components/system/ErrorBoundary'
import { formatYm } from '@/lib/datetime'
import GlobalAlertProvider from '@/components/system/GlobalAlertProvider'
import GlobalAlertBanner from '@/components/system/GlobalAlertBanner'

export const dynamic = 'force-dynamic'

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { year, month } = await getActiveMonth()
  const [activeBuildingId, activeFloor, contextOptions, activeVersion, openTickets] = await Promise.all([
    getActiveBuildingId(),
    getActiveFloor(),
    getContextOptions(),
    prisma.billingVersion.findFirst({
      where: { billingMonth: { year, month }, isActive: true },
      orderBy: { versionNo: 'desc' },
      select: { versionNo: true }
    }),
    prisma.ticket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } })
  ])

  const monthOptions = contextOptions.monthOptions.length > 0
    ? contextOptions.monthOptions
    : [{ year, month }]

  let isAdmin = false
  try {
    const h = await headers()
    const cookieHeader = h.get('cookie') ?? ''
    const user = await requireSession(new Request('http://local/', { headers: { cookie: cookieHeader } }))
    isAdmin = user.role === 'OWNER' || user.role === 'ADMIN'
  } catch {
    isAdmin = false
  }

  return (
    <html lang="th" suppressHydrationWarning>
      <body className="erp-bg-page erp-text-main">
        <DevConsoleFilter />
        <ThemeProvider>
          <ToastProvider>
            <GlobalAlertProvider>
              <GlobalAlertBanner />
              <div className="min-h-screen grid grid-cols-[auto,1fr] gap-3 p-3 pt-12">
              <aside className="w-64 rounded-2xl border erp-border bg-[var(--bg-surface)] shadow-sm p-3 hidden md:flex md:flex-col">
                <div className="px-2 py-2">
                  <div className="text-xs uppercase tracking-wide opacity-70">Apartment ERP</div>
                  <div className="text-lg font-bold">Control Center</div>
                </div>
                <nav className="grid gap-1 text-sm mt-2">
                  <div className="px-2 py-1 text-[11px] uppercase tracking-wide opacity-60">Dashboard</div>
                  <Link prefetch={false} className="px-3 py-2 rounded hover:bg-[var(--bg-soft)] transition-colors" href="/dashboard">Overview</Link>
                  <div className="px-2 pt-3 pb-1 text-[11px] uppercase tracking-wide opacity-60">Operations</div>
                  <Link prefetch={false} className="px-3 py-2 rounded hover:bg-[var(--bg-soft)] transition-colors" href="/rooms">Rooms</Link>
                  <Link prefetch={false} className="px-3 py-2 rounded hover:bg-[var(--bg-soft)] transition-colors" href="/tenants">Residents</Link>
                  <Link prefetch={false} className="px-3 py-2 rounded hover:bg-[var(--bg-soft)] transition-colors" href="/contracts">Contracts</Link>
                  <Link prefetch={false} className="px-3 py-2 rounded hover:bg-[var(--bg-soft)] transition-colors" href="/occupancy/move-out">Move-out</Link>
                  <div className="px-2 pt-3 pb-1 text-[11px] uppercase tracking-wide opacity-60">Billing</div>
                  <Link prefetch={false} className="px-3 py-2 rounded hover:bg-[var(--bg-soft)] transition-colors" href="/billing">Billing Months</Link>
                  <Link prefetch={false} className="px-3 py-2 rounded hover:bg-[var(--bg-soft)] transition-colors" href="/admin/documents/generate">Invoices</Link>
                  <Link prefetch={false} className="px-3 py-2 rounded hover:bg-[var(--bg-soft)] transition-colors" href="/billing?tab=overdue">Overdue</Link>
                  <Link prefetch={false} className="px-3 py-2 rounded hover:bg-[var(--bg-soft)] transition-colors" href="/payments">Payments</Link>
                  <div className="px-2 pt-3 pb-1 text-[11px] uppercase tracking-wide opacity-60">Automation</div>
                  <Link prefetch={false} className="px-3 py-2 rounded hover:bg-[var(--bg-soft)] transition-colors" href="/admin/system/automation">Jobs</Link>
                  <Link prefetch={false} className="px-3 py-2 rounded hover:bg-[var(--bg-soft)] transition-colors" href="/admin/system/automation?tab=history">Execution History</Link>
                  <Link prefetch={false} className="px-3 py-2 rounded hover:bg-[var(--bg-soft)] transition-colors" href="/admin/system/automation?tab=outbox">Outbox Monitor</Link>
                  <div className="px-2 pt-3 pb-1 text-[11px] uppercase tracking-wide opacity-60">Documents</div>
                  <Link prefetch={false} className="px-3 py-2 rounded hover:bg-[var(--bg-soft)] transition-colors" href="/admin/templates">Templates</Link>
                  <div className="px-2 pt-3 pb-1 text-[11px] uppercase tracking-wide opacity-60">Reports</div>
                  <Link prefetch={false} className="px-3 py-2 rounded hover:bg-[var(--bg-soft)] transition-colors" href="/analytics">Analytics</Link>
                  <div className="px-2 pt-3 pb-1 text-[11px] uppercase tracking-wide opacity-60">System</div>
                  <Link prefetch={false} className="px-3 py-2 rounded hover:bg-[var(--bg-soft)] transition-colors" href="/settings">Settings</Link>
                </nav>
              </aside>
              <main className="rounded-2xl border erp-border bg-[var(--bg-surface)] shadow-sm min-w-0">
                <header className="erp-topbar border-b erp-border flex items-center justify-between px-4">
                  <div className="flex items-center gap-3">
                    <Link href="/" className="font-bold text-sm tracking-wide">Apartment ERP</Link>
                    <span className="hidden md:inline text-xs opacity-70">{formatYm(year, month)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <ContextFilters
                      activeYear={year}
                      activeMonth={month}
                      activeBuildingId={activeBuildingId ?? ''}
                      activeFloor={activeFloor}
                      monthOptions={monthOptions}
                      buildingOptions={contextOptions.buildingOptions}
                      floorOptions={contextOptions.floorOptions}
                      onSetContext={setActiveContext}
                    />
                    <GlobalCommandK />
                    <NotificationBell />
                    <ThemeToggle />
                  </div>
                </header>
                <div className="p-6">
                  <ErrorBoundary>{children}</ErrorBoundary>
                </div>
                <nav className="md:hidden fixed bottom-2 left-2 right-2 rounded-2xl border erp-border bg-[var(--bg-surface)] shadow-sm px-2 py-1 z-50">
                  <div className="grid grid-cols-5 gap-1 text-[11px]">
                    <Link prefetch={false} className="px-3 py-2 rounded hover:bg-[var(--bg-soft)] text-center transition-colors" href="/dashboard">หน้าแรก</Link>
                    <Link prefetch={false} className="px-3 py-2 rounded hover:bg-[var(--bg-soft)] text-center transition-colors" href="/billing">บิล</Link>
                    <Link prefetch={false} className="px-3 py-2 rounded hover:bg-[var(--bg-soft)] text-center transition-colors" href="/payments">จ่ายเงิน</Link>
                    <Link prefetch={false} className="px-3 py-2 rounded hover:bg-[var(--bg-soft)] text-center transition-colors" href="/line">LINE</Link>
                    <Link prefetch={false} className="px-3 py-2 rounded hover:bg-[var(--bg-soft)] text-center transition-colors" href="/rooms">ห้องพัก</Link>
                  </div>
                </nav>
              </main>
              </div>
            </GlobalAlertProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
