import Link from 'next/link'

export default function AdminHome() {
  return (
    <main className="container">
      <h1>APARTMENT ERP — แดชบอร์ดผู้ดูแล</h1>
      <ul>
        <li><Link href="/api/health">API Healthcheck</Link></li>
      </ul>
    </main>
  )
}
