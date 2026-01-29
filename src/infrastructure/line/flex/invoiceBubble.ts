export function buildInvoiceBubble(input: {
  periodMonth: string
  totalAmount: number
  status: string
  invoiceId: string
}): { type: "flex"; altText: string; contents: Record<string, unknown> } {
  const alt = `บิล ${input.periodMonth} ยอด ${input.totalAmount} สถานะ ${input.status}`
  const contents = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "ข้อมูลบิล", weight: "bold", size: "md" },
        {
          type: "box",
          layout: "vertical",
          margin: "sm",
          contents: [
            { type: "text", text: `เดือน: ${input.periodMonth}` },
            { type: "text", text: `ยอด: ${input.totalAmount} บาท` },
            { type: "text", text: `สถานะ: ${input.status}` },
          ],
        },
      ],
    },
    footer: {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#22c55e",
          action: {
            type: "postback",
            label: "แจ้งโอนแล้ว",
            data: `action=report_paid&invoiceId=${encodeURIComponent(input.invoiceId)}`,
          },
        },
        {
          type: "button",
          style: "secondary",
          action: {
            type: "postback",
            label: "ชำระเงิน",
            data: `action=pay_info&invoiceId=${encodeURIComponent(input.invoiceId)}`,
          },
        },
      ],
    },
  }
  return { type: "flex", altText: alt, contents }
}

