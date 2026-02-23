export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="erp-card p-3 mb-3 text-sm flex flex-wrap gap-2">
        <a className="erp-nav-link" href="/admin/billing/upload">Upload Billing</a>
        <a className="erp-nav-link" href="/billing">Billing</a>
        <a className="erp-nav-link" href="/admin/templates">Templates</a>
        <a className="erp-nav-link" href="/admin/documents/generate">Generate Docs</a>
        <a className="erp-nav-link" href="/payments">Payments</a>
        <a className="erp-nav-link" href="/admin/tickets">Tickets</a>
        <a className="erp-nav-link" href="/analytics">Analytics</a>
      </nav>
      <div className="px-1">{children}</div>
    </>
  )
}
