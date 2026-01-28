type Occupancy = { totalRooms: number; occupiedRooms: number; availableRooms: number; occupancyRate: number }
type ActivityItem = { id: string; createdAt: string; action: string; entityType: string; entityId: string }
type UnpaidInvoice = { id: string; roomId: string; tenantId: string; amount: number; dueDate?: string }
type Meta = { status: "OK" | "STALE" | "PARTIAL" | "ERROR"; calculatedAt: string; freshnessMs?: number; reason?: string }

export default async function DashboardPage() {
  async function fetchResilient<T>(url: string, fallback: T): Promise<{ data: T; meta: Meta }> {
    const res = await fetch(url, { headers: { accept: "application/vnd.apartment.v1.1+json" }, cache: "no-store" })
    const now = new Date()
    try {
      const json = await res.json()
      if (json && typeof json === "object" && "success" in json) {
        if (json.success) {
          const m = (json.data && (json.data.meta as Meta)) || { status: "OK", calculatedAt: now.toISOString() }
          return { data: json.data as T, meta: m }
        }
        const message = (json.error && json.error.message) || "Error"
        return { data: fallback, meta: { status: "ERROR", calculatedAt: now.toISOString(), reason: String(message) } }
      }
      return { data: (json as T) ?? fallback, meta: { status: "OK", calculatedAt: now.toISOString() } }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { data: fallback, meta: { status: "ERROR", calculatedAt: now.toISOString(), reason: msg } }
    }
  }
  async function loadData(): Promise<{
    occupancy: { data: Occupancy | null; meta: Meta }
    activity: { data: ActivityItem[] | null; meta: Meta }
    unpaid: { data: UnpaidInvoice[] | null; meta: Meta }
  }> {
    const [o, a, u] = await Promise.all([
      fetchResilient<Occupancy>("/api/reports/occupancy", { totalRooms: 0, occupiedRooms: 0, availableRooms: 0, occupancyRate: 0 }),
      fetchResilient<ActivityItem[]>("/api/activity?limit=10", []),
      fetchResilient<UnpaidInvoice[]>("/api/invoices?status=UNPAID&limit=5", []),
    ])
    return { occupancy: { data: o.data, meta: o.meta }, activity: { data: a.data, meta: a.meta }, unpaid: { data: u.data, meta: u.meta } }
  }
  const { occupancy, activity, unpaid } = await loadData()
  return (
    <div className="space-y-6">
      <section className="border rounded p-4 bg-white">
        <h2 className="font-semibold mb-2">Occupancy</h2>
        <OccupancyBlock occupancy={occupancy.data} meta={occupancy.meta} />
      </section>
      <div className="grid grid-cols-2 gap-6">
        <section className="border rounded p-4 bg-white">
          <h2 className="font-semibold mb-2">Unpaid Invoices</h2>
          <UnpaidBlock unpaid={unpaid.data} meta={unpaid.meta} />
        </section>
        <section className="border rounded p-4 bg-white">
          <h2 className="font-semibold mb-2">Recent Activity</h2>
          <ActivityBlock activity={activity.data} meta={activity.meta} />
        </section>
      </div>
    </div>
  )
}

function OccupancyBlock({ occupancy, meta }: { occupancy: Occupancy | null; meta: Meta }) {
  return (
    <div className="flex gap-6">
      <div>Rooms: {occupancy ? occupancy.totalRooms : 0}</div>
      <div>Occupied: {occupancy ? occupancy.occupiedRooms : 0}</div>
      <div>Available: {occupancy ? occupancy.availableRooms : 0}</div>
      <div>Rate: {occupancy ? Math.round(occupancy.occupancyRate * 100) : 0}%</div>
      <div className="text-xs text-slate-500">
        {meta.status === "STALE" ? "ข้อมูลอาจไม่อัปเดตล่าสุด" : meta.status === "ERROR" ? "เกิดข้อผิดพลาดในการคำนวณ" : null}
        {meta.calculatedAt ? ` • calculatedAt: ${meta.calculatedAt}` : null}
      </div>
    </div>
  )
}

function UnpaidBlock({ unpaid, meta }: { unpaid: UnpaidInvoice[] | null; meta: Meta }) {
  if (!unpaid || unpaid.length === 0) {
    return (
      <div>
        <div className="text-slate-500">{unpaid ? "ไม่มีบิลค้างชำระ" : "ไม่มีข้อมูล"}</div>
        <div className="text-xs text-slate-500">
          {meta.status === "STALE" ? "ข้อมูลอาจไม่อัปเดตล่าสุด" : meta.status === "ERROR" ? "เกิดข้อผิดพลาดในการคำนวณ" : null}
          {meta.calculatedAt ? ` • calculatedAt: ${meta.calculatedAt}` : null}
        </div>
      </div>
    )
  }
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

function ActivityBlock({ activity, meta }: { activity: ActivityItem[] | null; meta: Meta }) {
  if (!activity || activity.length === 0) {
    return (
      <div>
        <div className="text-slate-500">{activity ? "ไม่มีรายการกิจกรรม" : "ไม่มีข้อมูล"}</div>
        <div className="text-xs text-slate-500">
          {meta.status === "STALE" ? "ข้อมูลอาจไม่อัปเดตล่าสุด" : meta.status === "ERROR" ? "เกิดข้อผิดพลาดในการคำนวณ" : null}
          {meta.calculatedAt ? ` • calculatedAt: ${meta.calculatedAt}` : null}
        </div>
      </div>
    )
  }
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
