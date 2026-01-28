import { describe, it, expect } from "vitest"
import { OverdueListView } from "@/app/admin/automation-candidates/invoices/overdue/page"
import { renderToStaticMarkup } from "react-dom/server"

describe("UI: Overdue Candidates Page", () => {
  it("snapshot renders with items", () => {
    const html = renderToStaticMarkup(
      OverdueListView({
        items: [
          { invoiceId: "inv-1", tenantId: "ten-1", roomId: "room-1", periodMonth: "2026-01", overdueDays: 10 },
          { invoiceId: "inv-2", tenantId: "ten-2", roomId: "room-2", periodMonth: "2026-01", overdueDays: 3 },
        ],
        loading: false,
        error: null,
        period: "2026-01",
        now: new Date(Date.UTC(2026, 0, 20)),
      }),
    )
    expect(html).toMatchSnapshot()
  })

  it("shows loading state", () => {
    const html = renderToStaticMarkup(
      OverdueListView({ items: [], loading: true, error: null, period: "2026-01" }),
    )
    expect(html.includes("กำลังโหลด")).toBe(true)
  })

  it("shows empty state", () => {
    const html = renderToStaticMarkup(
      OverdueListView({ items: [], loading: false, error: null, period: "2026-01" }),
    )
    expect(html.includes("ไม่มีข้อมูล")).toBe(true)
  })

  it("shows error state", () => {
    const html = renderToStaticMarkup(
      OverdueListView({ items: [], loading: false, error: "Error", period: "2026-01" }),
    )
    expect(html.includes("Error")).toBe(true)
  })
})
