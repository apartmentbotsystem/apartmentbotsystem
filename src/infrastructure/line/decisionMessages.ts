export function registrationApprovedMessage(room?: { roomNumber: string } | null): string {
  const roomText = room && room.roomNumber ? ` ห้อง ${room.roomNumber}` : ""
  return `คำขอสมัครของคุณได้รับการอนุมัติแล้ว${roomText} ระบบพร้อมใช้งาน คุณสามารถเริ่มต้นใช้งานได้แล้ว`
}

export function registrationRejectedMessage(): string {
  return "คำขอสมัครของคุณยังไม่ผ่านการตรวจสอบ คุณสามารถส่งคำขอสมัครใหม่ได้อีกครั้ง"
}
