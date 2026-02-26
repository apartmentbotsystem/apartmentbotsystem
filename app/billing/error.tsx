"use client"
export default function BillingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="p-4">
      <div className="text-lg font-semibold">ไม่สามารถโหลดข้อมูลบิล</div>
      <div className="text-sm mt-1 opacity-80">กรุณาลองใหม่อีกครั้ง</div>
      <button onClick={() => reset()} className="mt-2 px-2 py-1 border erp-border rounded text-sm">ลองใหม่</button>
    </div>
  )
}
