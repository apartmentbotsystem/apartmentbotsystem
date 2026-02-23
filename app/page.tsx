import Link from 'next/link'

export default function AdminHome() {
  return (
    <main className="container erp-page">
      <section className="erp-section">
        <h1>Apartment ERP</h1>
        <p className="opacity-80">เลือกเมนูจากแถบด้านซ้ายเพื่อเริ่มใช้งาน</p>
      </section>
      <section className="erp-section">
        <h2>เมนูด่วน</h2>
        <div className="flex flex-wrap gap-2 mt-2">
          <Link href="/dashboard" className="erp-nav-link">แดชบอร์ด</Link>
          <Link href="/billing" className="erp-nav-link">บิล</Link>
          <Link href="/payments" className="erp-nav-link">การชำระเงิน</Link>
          <Link href="/documents" className="erp-nav-link">เอกสาร</Link>
          <Link href="/line" className="erp-nav-link">กล่องข้อความ LINE</Link>
        </div>
      </section>
      <section className="erp-section">
        <h2>ระบบ</h2>
        <Link href="/api/health" className="erp-nav-link inline-block">ตรวจสุขภาพ API</Link>
      </section>
    </main>
  )
}
