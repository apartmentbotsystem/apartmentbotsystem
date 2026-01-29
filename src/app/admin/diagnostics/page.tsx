 'use client'
 
 import { useCallback, useEffect, useMemo, useState } from 'react'
 
 type Role = 'ADMIN' | 'STAFF' | null
 type AuditEvent = {
   id: string
   timestamp: string
   actorType: 'ADMIN' | 'STAFF' | 'SYSTEM'
   actorId: string | null
   action: string
   targetType: 'INVOICE' | 'PAYMENT' | 'AUTH' | 'CONTRACT' | 'TICKET' | 'TENANT'
   targetId: string | null
   severity: 'INFO' | 'WARN' | 'CRITICAL'
   metadata: Record<string, unknown> | null
 }
 
 async function fetchAny<T>(url: string, init?: RequestInit): Promise<T> {
   const res = await fetch(url, {
     ...init,
     headers: { ...(init?.headers || {}), accept: 'application/vnd.apartment.v1.1+json' },
     cache: 'no-store',
   })
   const json = await res.json().catch(() => null)
   if (json && typeof json === 'object' && 'success' in json) {
     if (json.success) return json.data as T
     const message = (json.error && json.error.message) || 'Error'
     throw new Error(String(message))
   }
   return json as T
 }
 
 export default function AdminDiagnosticsPage() {
   const [role, setRole] = useState<Role>(null)
   const [invoiceId, setInvoiceId] = useState<string>('')
   const [from, setFrom] = useState<string>('')
   const [to, setTo] = useState<string>('')
   const [loading, setLoading] = useState(false)
   const [error, setError] = useState<string | null>(null)
   const [invoiceEvents, setInvoiceEvents] = useState<AuditEvent[]>([])
   const [paymentEvents, setPaymentEvents] = useState<AuditEvent[]>([])
 
   const canView = useMemo(() => role === 'ADMIN', [role])
 
  const buildRangeParams = useCallback(() => {
     const params = new URLSearchParams()
     if (from) params.set('from', new Date(from).toISOString())
     if (to) params.set('to', new Date(to).toISOString())
     return params
  }, [from, to])
 
   const load = useCallback(async () => {
     setLoading(true)
     setError(null)
     try {
       const sess = await fetchAny<{ userId: string | null; role: 'ADMIN' | 'STAFF' | null }>('/api/auth/session')
       setRole(sess?.role ?? null)
       const rangeParams = buildRangeParams()
       const invParams = new URLSearchParams(rangeParams.toString())
       invParams.set('targetType', 'INVOICE')
       invParams.set('limit', '100')
       if (invoiceId) invParams.set('targetId', invoiceId)
       const invData = await fetchAny<AuditEvent[]>(`/api/admin/audit-events?${invParams.toString()}`)
       const invFiltered = invData.filter((e) => e.action === 'INVOICE_PAID')
       setInvoiceEvents(invFiltered)
       const payParams = new URLSearchParams(rangeParams.toString())
       payParams.set('targetType', 'PAYMENT')
       payParams.set('limit', '100')
       const payData = await fetchAny<AuditEvent[]>(`/api/admin/audit-events?${payParams.toString()}`)
       const payFiltered = payData.filter((e) => {
         if (invoiceId) {
           const meta = e.metadata || {}
           return e.action === 'PAYMENT_CONFIRMED' && String(meta['invoiceId'] || '') === invoiceId
         }
         return e.action === 'PAYMENT_CONFIRMED'
       })
       setPaymentEvents(payFiltered)
     } catch (e) {
       const msg = e instanceof Error ? e.message : String(e)
       setError(msg)
       setInvoiceEvents([])
       setPaymentEvents([])
     } finally {
       setLoading(false)
     }
  }, [invoiceId, buildRangeParams])
 
   useEffect(() => {
     load()
   }, [load])
 
   if (!canView) {
     return <div className="p-4 text-red-600">ต้องเป็น Admin เท่านั้น</div>
   }
 
   return (
     <div className="space-y-6 p-4">
       <h2 className="font-semibold text-lg">Admin Diagnostics</h2>
       <div className="flex items-end gap-3">
         <div className="flex flex-col">
           <label className="text-sm">Invoice ID</label>
           <input value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} className="border rounded px-2 py-1" />
         </div>
         <div className="flex flex-col">
           <label className="text-sm">From</label>
           <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded px-2 py-1" />
         </div>
         <div className="flex flex-col">
           <label className="text-sm">To</label>
           <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded px-2 py-1" />
         </div>
         <button onClick={load} className="rounded bg-slate-800 px-3 py-2 text-white">
           Refresh
         </button>
       </div>
       {error && <div className="text-red-600">{error}</div>}
       <div className="grid grid-cols-2 gap-6">
         <section className="border rounded bg-white">
           <div className="p-3 border-b font-semibold">Confirm Payment Events</div>
           <div className="p-3">
             {loading ? (
               <div>กำลังโหลด...</div>
             ) : invoiceEvents.length === 0 ? (
               <div>ไม่มีข้อมูล</div>
             ) : (
               <table className="w-full text-sm">
                 <thead>
                   <tr className="text-left">
                     <th className="p-2">Time</th>
                     <th className="p-2">Actor</th>
                     <th className="p-2">Invoice</th>
                     <th className="p-2">Severity</th>
                   </tr>
                 </thead>
                 <tbody>
                   {invoiceEvents.map((e) => (
                     <tr key={e.id} className="border-t">
                       <td className="p-2">{new Date(e.timestamp).toLocaleString()}</td>
                       <td className="p-2">{e.actorType}</td>
                       <td className="p-2">{e.targetId || '-'}</td>
                       <td className="p-2">{e.severity}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             )}
           </div>
         </section>
         <section className="border rounded bg-white">
           <div className="p-3 border-b font-semibold">Payment Reported Events</div>
           <div className="p-3">
             {loading ? (
               <div>กำลังโหลด...</div>
             ) : paymentEvents.length === 0 ? (
               <div>ไม่มีข้อมูล</div>
             ) : (
               <table className="w-full text-sm">
                 <thead>
                   <tr className="text-left">
                     <th className="p-2">Time</th>
                     <th className="p-2">Actor</th>
                     <th className="p-2">Invoice</th>
                     <th className="p-2">Method</th>
                   </tr>
                 </thead>
                 <tbody>
                   {paymentEvents.map((e) => {
                     const meta = e.metadata || {}
                     const inv = String(meta['invoiceId'] || '') || e.targetId || '-'
                     const method = String(meta['method'] || '') || '-'
                     return (
                       <tr key={e.id} className="border-t">
                         <td className="p-2">{new Date(e.timestamp).toLocaleString()}</td>
                         <td className="p-2">{e.actorType}</td>
                         <td className="p-2">{inv}</td>
                         <td className="p-2">{method}</td>
                       </tr>
                     )
                   })}
                 </tbody>
               </table>
             )}
           </div>
         </section>
       </div>
     </div>
   )
 }
