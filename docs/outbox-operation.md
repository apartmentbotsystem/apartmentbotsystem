# Outbox Operation

## เมื่อไรที่ Outbox ทำงาน
- เมื่อมีการสร้างบันทึก OUTBOUND message สำหรับ Ticket ระบบจะสร้าง Outbox (status=PENDING)
- Worker CLI อ่าน Outbox ที่สถานะ PENDING และ nextRetryAt เป็น null หรือถึงเวลาแล้ว
- Worker ส่งข้อความไปยัง LINE แล้วอัปเดตสถานะเป็น SENT หรือ FAILED ตามผลลัพธ์

## Idempotency
- การประมวลผลซ้ำปลอดภัย: รายการที่ไม่ใช่ PENDING จะถูกข้าม
- การส่งซ้ำไม่ทำให้สถานะผิดพลาด เนื่องจากผลลัพธ์ถูกบันทึกไว้ในฐานข้อมูล

## Run Identifier (runId)
- Worker แต่ละรอบจะสร้าง `runId` (timestamp + random)
- ทุกบรรทัด log ใน run นั้นมี `runId` กำกับ เพื่อการ trace
- `runId` ใช้สำหรับ log เท่านั้น ไม่ถูกบันทึกลงฐานข้อมูล

## กรณีฐานข้อมูลล่ม (DB down)
- Worker จะล้มด้วย error ระดับ infra และจบการทำงานด้วย exit code ≠ 0
- แนวทาง: ตรวจสอบการเชื่อมต่อ DB, รันใหม่เมื่อระบบพร้อม
- เหตุการณ์นี้ไม่ถือเป็น bug ของ Worker

## กรณี LINE API ล่ม
- การส่งจะล้มเหลวในระดับรายการ และถูกบันทึกเป็น FAILED พร้อมข้อความ error
- ระบบมีนโยบาย retry/backoff ในระดับ Outbox (ตาม Phase C5/C6 ที่กำหนด)
- Worker ยังประมวลผลรายการอื่นต่อได้

## Dry-Run Mode
- ตั้งค่า `OUTBOX_DRY_RUN=1` เพื่อซ้อมรันโดยไม่กระทบระบบจริง
- พฤติกรรม:
  - อ่าน outbox batch
  - แสดง payload ที่จะส่งใน log
  - ไม่เรียกส่ง LINE จริง และไม่อัปเดตฐานข้อมูล
- เมื่อปิด dry-run จะทำงานตามปกติ

## ข้อผิดพลาดที่คาดหวัง (Expected Errors)
- การตั้งค่า LINE access token ไม่ถูกต้อง หรือไม่ตั้งค่า
- การเชื่อมต่อฐานข้อมูลล้มเหลวชั่วคราว
- เครือข่ายไปยัง LINE มีปัญหา
- เหล่านี้ไม่ใช่ bug ของธุรกิจ แต่เป็นสถานการณ์ปฏิบัติการ

## การดูแลระบบ (Operational)
- รัน Worker ด้วย CLI/cron/CI โดยไม่ขึ้นกับ lifecycle ของ Next.js
- ตรวจสอบผลลัพธ์ได้จาก log:
  - info: การเริ่มต้น batch และสรุปจำนวนที่ประมวลผล
  - warn: รายการที่ส่งไม่ได้แต่ระบบดำเนินต่อ
  - error: ปัญหาโครงสร้างพื้นฐาน (เช่น Prisma/LINE) ระดับรันงาน

### ตัวอย่าง Log
- Start: `[outbox] info start batch { runId, limit }`
- Dry-run item: `[outbox] info dry-run payload { runId, messageId, ticketId, externalThreadId, text }`
- Warn failure: `[outbox] warn send failed { runId, outboxId, message }`
- Summary: `[outbox] info summary { runId, processed, success, failed, mode? }`
