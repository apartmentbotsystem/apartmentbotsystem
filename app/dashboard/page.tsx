import PageHeader from '@/components/system/PageHeader'
import MetricCard from '@/components/system/MetricCard'
import SectionCard from '@/components/system/SectionCard'
import RevenueLineChart from '@/components/charts/RevenueLineChart'
import OccupancyAreaChart from '@/components/charts/OccupancyAreaChart'
import OverdueBarChart from '@/components/charts/OverdueBarChart'
import PaymentPieChart from '@/components/charts/PaymentPieChart'
import { TrendingUp, Users, Clock4, Inbox } from 'lucide-react'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getActiveMonth } from '@/lib/context'

async function getKpis() {
  const { year, month } = await getActiveMonth()
  const [rooms, occupied, overdueSum, outboxPending] = await Promise.all([
    prisma.room.count(),
    prisma.room.count({ where: { status: 'OCCUPIED' } }),
    prisma.billingRecord.aggregate({ _sum: { amount: true }, where: { status: 'OVERDUE', billingMonth: { year, month } } }),
    prisma.messageOutbox.count({ where: { status: { in: ['PENDING', 'FAILED'] } } })
  ])
  const occRate = rooms > 0 ? Math.round((occupied / rooms) * 100) : 0
  const revenueAgg = await prisma.billingRecord.aggregate({
    _sum: { amount: true },
    where: { status: { in: ['PAID'] }, billingMonth: { year, month } }
  })
  const prevYm = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
  const prevAgg = await prisma.billingRecord.aggregate({
    _sum: { amount: true },
    where: { status: { in: ['PAID'] }, billingMonth: { year: prevYm.year, month: prevYm.month } }
  })
  const prevOverdue = await prisma.billingRecord.aggregate({
    _sum: { amount: true },
    where: { status: 'OVERDUE', billingMonth: { year: prevYm.year, month: prevYm.month } }
  })
  return {
    revenue: Number(revenueAgg._sum?.amount ?? 0),
    overdue: Number(overdueSum._sum.amount ?? 0),
    revenuePrev: Number(prevAgg._sum?.amount ?? 0),
    overduePrev: Number(prevOverdue._sum.amount ?? 0),
    occupancy: occRate,
    outboxPending
  }
}

function MiniBar({ data }: { data: number[] }) {
  const max = Math.max(1, ...data)
  const w = 220
  const h = 64
  const barW = Math.floor(w / data.length)
  return (
    <svg width={w} height={h} className="mt-3">
      {data.map((v, i) => {
        const barH = Math.round((v / max) * (h - 10))
        return <rect key={i} x={i * barW + 2} y={h - barH} width={barW - 4} height={barH} className="fill-teal-500/50 dark:fill-teal-400/40" />
      })}
    </svg>
  )
}

export default async function DashboardPage() {
  const k = await getKpis()
  const revenueTrend = [12, 9, 14, 11, 16, 18]
  const overdueTrend = [4, 5, 3, 6, 7, 5]
  const occupancyTrend = [82, 85, 84, 86, 88, 90]
  const pct = (a: number, b: number) => b === 0 ? 0 : Math.round(((a - b) / b) * 100)
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="ภาพรวมการดำเนินงานและตัวชี้วัดสำคัญ" />
      <div className="grid md:grid-cols-4 gap-6">
        <Link href="/payments" className="block">
          <MetricCard label="Revenue (this month)" countTo={k.revenue} hint={`${pct(k.revenue, k.revenuePrev)}% vs last month`} accent="teal" />
        </Link>
        <Link href="/billing?tab=overdue" className="block">
          <MetricCard label="Outstanding balance" countTo={k.overdue} hint={`${pct(k.overdue, k.overduePrev)}% vs last month`} accent="rose" />
        </Link>
        <Link href="/rooms" className="block">
          <MetricCard label="Occupancy rate" countTo={k.occupancy} suffix="%" hint="now" accent="blue" />
        </Link>
        <Link href="/admin/system/automation?tab=outbox" className="block">
          <MetricCard label="Outbox pending" countTo={k.outboxPending} hint="pending/failed" accent="amber" />
        </Link>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        <SectionCard title="Revenue Trend (6 months)">
          <RevenueLineChart data={revenueTrend.map((v, i) => ({ name: `${i + 1}`, value: v }))} />
        </SectionCard>
        <SectionCard title="Overdue Breakdown">
          <OverdueBarChart data={overdueTrend.map((v, i) => ({ name: `${i + 1}`, value: v }))} />
        </SectionCard>
        <SectionCard title="Occupancy Trend">
          <OccupancyAreaChart data={occupancyTrend.map((v, i) => ({ name: `${i + 1}`, value: v }))} />
        </SectionCard>
      </div>
      <SectionCard title="Payment Status">
        <PaymentPieChart data={[
          { name: 'Paid', value: 60 },
          { name: 'Partial', value: 20 },
          { name: 'Overdue', value: 20 }
        ]} />
      </SectionCard>
      <SectionCard title="Alerts">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-lg border erp-border p-4">
            <div className="font-semibold mb-1">Overdue &gt; 30 days</div>
            <div className="text-sm text-muted-foreground">ตรวจสอบห้องที่ค้างบิลเกิน 30 วัน</div>
          </div>
          <div className="rounded-lg border erp-border p-4">
            <div className="font-semibold mb-1">Failed Jobs</div>
            <div className="text-sm text-muted-foreground">ตรวจสอบงานที่ล้มเหลวล่าสุด</div>
          </div>
          <div className="rounded-lg border erp-border p-4">
            <div className="font-semibold mb-1">Dead Outbox</div>
            <div className="text-sm text-muted-foreground">ข้อความที่ส่งไม่สำเร็จครบจำนวนครั้ง</div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
