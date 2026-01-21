export default function AdminInvoicesPage() {
  async function createSample() {
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: "room-1", tenantId: "tenant-1", amount: 1000, month: "2026-01" }),
    })
    const data = await res.json()
    alert(JSON.stringify(data))
  }
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Invoices</h1>
      <button className="mt-4 rounded bg-slate-800 px-4 py-2 text-white" onClick={createSample}>
        Create Sample Invoice
      </button>
    </div>
  )
}

