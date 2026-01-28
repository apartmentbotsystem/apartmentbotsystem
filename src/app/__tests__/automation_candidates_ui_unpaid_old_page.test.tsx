import { describe, it, expect } from "vitest"
import { UnpaidOldListView } from "@/app/admin/automation-candidates/invoices/unpaid-old/page"
import { renderToStaticMarkup } from "react-dom/server"

describe("UI: Unpaid Old Candidates Page", () => {
  it("snapshot renders with items", () => {
    const html = renderToStaticMarkup(
      UnpaidOldListView({
        items: [{ invoiceId: "inv-1", daysSinceSent: 12 }],
        loading: false,
        error: null,
        minDays: 7,
        now: new Date(Date.UTC(2026, 0, 20)),
      }),
    )
    expect(html).toMatchSnapshot()
  })

  it("shows loading state", () => {
    const html = renderToStaticMarkup(
      UnpaidOldListView({ items: [], loading: true, error: null, minDays: 7 }),
    )
    expect(html.includes("กำลังโหลด")).toBe(true)
  })

  it("shows empty state", () => {
    const html = renderToStaticMarkup(
      UnpaidOldListView({ items: [], loading: false, error: null, minDays: 7 }),
    )
    expect(html.includes("ไม่มีข้อมูล")).toBe(true)
  })

  it("shows error state", () => {
    const html = renderToStaticMarkup(
      UnpaidOldListView({ items: [], loading: false, error: "Error", minDays: 7 }),
    )
    expect(html.includes("Error")).toBe(true)
  })
})
