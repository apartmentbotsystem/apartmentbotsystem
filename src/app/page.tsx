import Link from "next/link"

export default function HomePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Welcome</h1>
      <p>ไปที่ Dashboard เพื่อเริ่มงาน</p>
      <Link href="/dashboard" className="rounded bg-slate-800 px-3 py-1 text-white">
        ไปหน้า Dashboard
      </Link>
    </div>
  )
}
