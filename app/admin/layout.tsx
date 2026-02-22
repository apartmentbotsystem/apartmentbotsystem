export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <nav style={{ padding: 12, borderBottom: '1px solid #ddd' }}>
          <a href="/admin/billing/upload" style={{ marginRight: 12 }}>อัปโหลดบิล</a>
          <a href="/admin/billing/2026/2" style={{ marginRight: 12 }}>แก้ไขบิล</a>
          <a href="/admin/templates" style={{ marginRight: 12 }}>เทมเพลต</a>
          <a href="/admin/documents/generate" style={{ marginRight: 12 }}>สร้างเอกสาร</a>
          <a href="/admin/payments" style={{ marginRight: 12 }}>ชำระเงิน</a>
          <a href="/admin/tickets" style={{ marginRight: 12 }}>ทิกเก็ต</a>
          <a href="/admin/messages" style={{ marginRight: 12 }}>ข้อความ</a>
          <a href="/admin/analytics" style={{ marginRight: 12 }}>ภาพรวม</a>
        </nav>
        <div style={{ padding: 16 }}>{children}</div>
      </body>
    </html>
  )
}
