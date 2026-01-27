import type { RegistrationState } from "@/infrastructure/registration/registration.service"

export function messageForState(state: RegistrationState): string {
  if (state === "ACTIVE") return "บัญชีของคุณเปิดใช้งานแล้ว"
  if (state === "PENDING") return "คำขอสมัครของคุณอยู่ระหว่างการตรวจสอบจากแอดมิน"
  if (state === "REJECTED") return "คำขอสมัครก่อนหน้านี้ถูกปฏิเสธ คุณสามารถส่งคำขอใหม่ได้"
  return "พิมพ์คำว่า “สมัคร” หรือ “ลงทะเบียน” เพื่อเริ่มต้น"
}
