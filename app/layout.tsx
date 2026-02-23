import './globals.css'
import { ReactNode } from 'react'
import Link from 'next/link'
import ToastProvider from '@/components/ui/ToastProvider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { getActiveMonth, getActiveBuildingId, getActiveFloor, getContextOptions } from '@/lib/context'
import { prisma } from '@/lib/db'
import { setActiveContext } from './context-actions'
import TopContextForm from './top-context-form'
import GlobalCommandK from '@/components/ui/GlobalCommandK'

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

  return (
    <html lang="th" suppressHydrationWarning>
      <body className="erp-bg-page erp-text-main">
        <ThemeProvider>
          <ToastProvider>
            <div className="min-h-screen flex gap-4 p-3">
              <aside className="w-64 erp-card p-3 hidden md:flex md:flex-col">
                <div className="px-2 py-2">
                  <div className="text-xs uppercase tracking-wide opacity-70">Apartment ERP</div>
                  <div className="text-lg font-bold">ศูนย์ควบคุม</div>
                </div>
                <nav className="grid gap-1 text-sm mt-2">
                  <Link className="erp-nav-link" href="/dashboard">แดชบอร์ด</Link>
                  <Link className="erp-nav-link" href="/occupancy">การเข้าอยู่</Link>
                  <Link className="erp-nav-link" href="/rooms">ห้องพัก</Link>
                  <Link className="erp-nav-link" href="/tenants">ผู้เช่า</Link>
                  <Link className="erp-nav-link" href="/billing">บิล</Link>
                  <Link className="erp-nav-link" href="/payments">การชำระเงิน</Link>
                  <Link className="erp-nav-link" href="/documents">เอกสาร</Link>
                  <Link className="erp-nav-link" href="/analytics">วิเคราะห์ข้อมูล</Link>
                  <Link className="erp-nav-link" href="/line">LINE Inbox</Link>
                  <Link className="erp-nav-link" href="/tickets">ทิกเก็ต</Link>
                  <Link className="erp-nav-link" href="/settings">ตั้งค่า</Link>
                  <Link className="erp-nav-link" href="/audit">บันทึกตรวจสอบ</Link>
                </nav>
              </aside>
              <main className="flex-1 min-w-0">
                <header className="erp-topbar erp-card sticky top-0 z-40">
                  <div className="flex items-center justify-between px-3 py-2 gap-2">
                    <div className="flex items-center gap-3">
                      <Link href="/" className="font-bold text-sm tracking-wide">Apartment ERP</Link>
                      <span className="hidden md:inline text-xs opacity-70">{year}-{String(month).padStart(2, '0')}</span>
                    </div>
                    <div className="hidden md:flex items-center gap-2">
                      <details className="relative">
                        <summary className="chip cursor-pointer select-none">บริบท</summary>
                        <div className="absolute right-0 mt-2 erp-card p-2 min-w-[420px] shadow-lg">
                          <TopContextForm
                            activeYear={year}
                            activeMonth={month}
                            activeBuildingId={activeBuildingId ?? ''}
                            activeFloor={activeFloor}
                            monthOptions={monthOptions}
                            buildingOptions={contextOptions.buildingOptions}
                            floorOptions={contextOptions.floorOptions}
                            onSetContext={setActiveContext}
                          />
                        </div>
                      </details>
                      <GlobalCommandK />
                      <Link href="/tickets" className="chip" aria-label="การแจ้งเตือน">
                        แจ้งเตือน{openTickets > 0 ? ` (${openTickets})` : ''}
                      </Link>
                      <ThemeToggle />
                    </div>
                    <div className="md:hidden flex items-center gap-2">
                      <Link href="/tickets" className="chip" aria-label="การแจ้งเตือน">
                        แจ้งเตือน{openTickets > 0 ? ` (${openTickets})` : ''}
                      </Link>
                      <ThemeToggle />
                    </div>
                  </div>
                </header>
                <div className="p-4 pt-5 pb-20 md:pb-4">
                  {children}
                </div>
                <nav className="md:hidden fixed bottom-2 left-2 right-2 erp-card px-2 py-1 z-50">
                  <div className="grid grid-cols-5 gap-1 text-[11px]">
                    <Link className="erp-nav-link text-center !py-2" href="/dashboard">หน้าแรก</Link>
                    <Link className="erp-nav-link text-center !py-2" href="/billing">บิล</Link>
                    <Link className="erp-nav-link text-center !py-2" href="/payments">จ่ายเงิน</Link>
                    <Link className="erp-nav-link text-center !py-2" href="/line">LINE</Link>
                    <Link className="erp-nav-link text-center !py-2" href="/rooms">ห้องพัก</Link>
                  </div>
                </nav>
              </main>
            </div>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
