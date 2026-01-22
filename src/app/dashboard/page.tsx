type Occupancy = { totalRooms: number; occupiedRooms: number; availableRooms: number; occupancyRate: number }
type ActivityItem = { id: string; createdAt: string; action: string; entityType: string; entityId: string }
type UnpaidInvoice = { id: string; roomId: string; tenantId: string; amount: number; dueDate?: string }

export default async function DashboardPage() {
  async function fetchJson(url: string) {
    const res = await fetch(url, { headers: { accept: "application/vnd.apartment.v1.1+json" }, cache: "no-store" })
    const json = await res.json()
    if (json.success) return json.data
    throw new Error(json.error?.message || "Error")
  }
  async function loadData(): Promise<{
    occupancy: Occupancy | null
    activity: ActivityItem[] | null
    unpaid: UnpaidInvoice[] | null
  }> {
    try {
      const results = await Promise.all([
        fetchJson("/api/reports/occupancy"),
        fetchJson("/api/activity?limit=10"),
        fetchJson("/api/invoices?status=UNPAID&limit=5"),
      ])
      const [o, a, u] = results as [Occupancy | null, ActivityItem[] | null, UnpaidInvoice[] | null]
      return { occupancy: o, activity: a, unpaid: u }
    } catch {
      return { occupancy: null, activity: null, unpaid: null }
    }
  }
  const { occupancy, activity, unpaid } = await loadData()
  return (
    <div className="space-y-6">
      <section className="border rounded p-4 bg-white">
        <h2 className="font-semibold mb-2">Occupancy</h2>
        <OccupancyBlock occupancy={occupancy} />
      </section>
      <div className="grid grid-cols-2 gap-6">
        <section className="border rounded p-4 bg-white">
          <h2 className="font-semibold mb-2">Unpaid Invoices</h2>
          <UnpaidBlock unpaid={unpaid} />
        </section>
        <section className="border rounded p-4 bg-white">
          <h2 className="font-semibold mb-2">Recent Activity</h2>
          <ActivityBlock activity={activity} />
        </section>
      </div>
    </div>
  )
}

function OccupancyBlock({ occupancy }: { occupancy: Occupancy | null }) {
  if (!occupancy) return <div className="text-slate-500">เกิดข้อผิดพลาดในการโหลด</div>
  return (
    <div className="flex gap-6">
      <div>Rooms: {occupancy.totalRooms}</div>
      <div>Occupied: {occupancy.occupiedRooms}</div>
      <div>Available: {occupancy.availableRooms}</div>
      <div>Rate: {Math.round(occupancy.occupancyRate * 100)}%</div>
    </div>
  )
}

function UnpaidBlock({ unpaid }: { unpaid: UnpaidInvoice[] | null }) {
  if (!unpaid) return <div className="text-slate-500">เกิดข้อผิดพลาดในการโหลด</div>
  if (!unpaid.length) return <div className="text-slate-500">ไม่มีบิลค้างชำระ</div>
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left">
          <th>Invoice</th>
          <th>Room</th>
          <th>Tenant</th>
          <th>Amount</th>
          <th>Due</th>
        </tr>
      </thead>
      <tbody>
        {unpaid.map((r) => (
          <tr key={r.id} className="border-t">
            <td>{r.id}</td>
            <td>{r.roomId}</td>
            <td>{r.tenantId}</td>
            <td>{r.amount}</td>
            <td>{r.dueDate || "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ActivityBlock({ activity }: { activity: ActivityItem[] | null }) {
  if (!activity) return <div className="text-slate-500">เกิดข้อผิดพลาดในการโหลด</div>
  if (!activity.length) return <div className="text-slate-500">ไม่มีรายการกิจกรรม</div>
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left">
          <th>Time</th>
          <th>Action</th>
          <th>Entity</th>
        </tr>
      </thead>
      <tbody>
        {activity.map((a) => (
          <tr key={a.id} className="border-t">
            <td>{a.createdAt}</td>
            <td>{a.action}</td>
            <td>
              {a.entityType}:{a.entityId}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
