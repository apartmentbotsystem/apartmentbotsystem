export const REQUIRED_BILLING_HEADERS = [
  'เดือน',
  'ห้อง',
  'ชื่อบัญชี',
  'ธนาคาร',
  'หมายเลขบัญชี',
  'ค่าเช่า',
  'น้ำก่อน',
  'น้ำหลัง',
  'ใช้น้ำ',
  'ค่าน้ำต่อหน่วย',
  'ค่าบริการมิเตอร์น้ำ',
  'รวมค่าน้ำ',
  'ไฟก่อน',
  'ไฟหลัง',
  'ใช้ไฟ',
  'ค่าไฟต่อหน่วย',
  'ค่าบริการมิเตอร์ไฟ',
  'รวมค่าไฟ',
  'เฟอร์',
  'อื่นๆ',
  'รวมเงิน',
  'หมายเหตุ'
] as const

export type BillingHeader = (typeof REQUIRED_BILLING_HEADERS)[number]

export function normalizeBillingHeader(value: unknown): string {
  return String(value ?? '').replace(/\u00A0/g, ' ').trim().replace(/\s+/g, ' ')
}

const THAI_DIGIT_MAP: Record<string, string> = {
  '๐': '0',
  '๑': '1',
  '๒': '2',
  '๓': '3',
  '๔': '4',
  '๕': '5',
  '๖': '6',
  '๗': '7',
  '๘': '8',
  '๙': '9'
}

export function toNumberFromExcel(raw: unknown): number {
  if (raw == null) return Number.NaN
  const normalizedDigits = String(raw).replace(/[๐-๙]/g, (d) => THAI_DIGIT_MAP[d] ?? d)
  const numeric = normalizedDigits.replace(/[,\s฿]/g, '').replace(/[^0-9.\-]/g, '')
  return Number.parseFloat(numeric)
}
