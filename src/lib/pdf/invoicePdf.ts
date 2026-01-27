export type InvoicePdfInput = {
  invoice: {
    id: string
    periodMonth: string
    rentAmount: number
    waterAmount: number
    electricAmount: number
    totalAmount: number
  }
  tenant: {
    name: string
  }
  room: {
    roomNumber: string
  }
}

export async function generateInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  const lines = [
    `Invoice ID: ${input.invoice.id}`,
    `Period: ${input.invoice.periodMonth}`,
    `Room: ${input.room.roomNumber}`,
    `Tenant: ${input.tenant.name}`,
    `Rent: ${input.invoice.rentAmount} THB`,
    `Water: ${input.invoice.waterAmount} THB`,
    `Electric: ${input.invoice.electricAmount} THB`,
    `Total: ${input.invoice.totalAmount} THB`,
  ]
  const content = lines.join("\\n")
  const objects: string[] = []
  const xref: number[] = []
  function addObject(obj: string): number {
    const offset = objects.reduce((acc, cur) => acc + cur.length, 0)
    xref.push(offset)
    objects.push(obj)
    return objects.length
  }
  addObject("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
  addObject("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")
  addObject("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n")
  const stream =
    "BT\n/F1 12 Tf\n50 780 Td\n" +
    content
      .split("\\n")
      .map((line, idx) => (idx === 0 ? `(${escapePdfText(line)}) Tj` : `T* (${escapePdfText(line)}) Tj`))
      .join("\n") +
    "\nET"
  addObject(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`)
  addObject("5 0 obj\n<< /Type /Font /Subtype /Type1 /Name /F1 /BaseFont /Helvetica >>\nendobj\n")
  const header = "%PDF-1.4\n"
  const body = objects.join("")
  const xrefStart = header.length + body.length
  const xrefTable =
    "xref\n0 " +
    (objects.length + 1) +
    "\n0000000000 65535 f \n" +
    xref
      .map((offset) => String(offset + header.length).padStart(10, "0") + " 00000 n ")
      .join("\n") +
    "\n"
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  const pdf = header + body + xrefTable + trailer
  return Buffer.from(pdf, "utf-8")
}

function escapePdfText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
}
