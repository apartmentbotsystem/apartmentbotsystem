# Phase J — LINE OA Payment Flow (Stabilize & Deploy)

## ภาพรวม Flow
- ผู้เช่าโต้ตอบผ่าน LINE OA เท่านั้น
- ระบบรองรับข้อความ “บิล”, “ค้างชำระ”, “ยอดเดือนนี้” เพื่อตอบข้อมูลบิลล่าสุดเป็น Flex Message
- ปุ่มใน Flex:
  - “แจ้งโอนแล้ว” → ระบบบันทึก AuditEvent: PAYMENT_REPORTED
  - “ชำระเงิน” → ให้ข้อมูลวิธีการชำระ
- ฝั่ง Admin อนุมัติผ่านระบบเดิม: /api/admin/invoices/[id]/confirm-payment → เปลี่ยนสถานะเป็น PAID และสร้าง Payment

## คำสั่งที่ Tenant พิมพ์ได้
- บิล
- ค้างชำระ
- ยอดเดือนนี้

## สิ่งที่ระบบ “ไม่ทำ”
- ไม่เปิดฟอร์มชำระเงินบนเว็บ /tenant
- ไม่อัปโหลดสลิปใน Phase นี้
- ไม่ทำ auto-match ยอดโอนกับบิล
- ไม่เพิ่ม Chat UI ใน Dashboard

## วิธี Debug เมื่อ Webhook ไม่เข้า
- ตรวจว่า LINE_CHANNEL_SECRET และ LINE_CHANNEL_ACCESS_TOKEN ถูกตั้งใน Environment
- ตรวจ Response ของ /api/line/webhook:
  - 401 invalid signature → ตรวจการตั้งค่า channel secret/signature ที่ฝั่ง LINE
  - 500 LINE not configured → ตรวจ env ว่าตั้งค่าแล้ว
  - 200 ok แต่ไม่มี action → ตรวจ payload events ว่ามีและถูกต้องตามสัญญา
- ตรวจ log แบบ structured:
  - level: info/warn/error
  - ไม่บันทึก PII เช่น ข้อความเต็มหรือ lineUserId

## ข้อควรระวังด้าน Security
- ตรวจลายเซ็นทุกคำขอด้วย x-line-signature
- ห้ามผู้ใช้ส่ง tenantId เอง; ทำ mapping lineUserId → tenantId ฝั่ง server เท่านั้น
- หลีกเลี่ยงการ log PII; ใช้โครงสร้าง logger เดิมด้วยข้อมูลขั้นต่ำ (requestId/method/path/status)

