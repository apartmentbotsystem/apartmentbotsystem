import { describe, it, expect } from "vitest"
import { NoReplyListView } from "@/app/admin/automation-candidates/tickets/no-reply/page"
import { renderToStaticMarkup } from "react-dom/server"

describe("UI: Tickets No-Reply Candidates Page", () => {
  it("snapshot renders with items", () => {
    const html = renderToStaticMarkup(
      NoReplyListView({
        items: [{ ticketId: "t1", daysOpen: 5, lastReplyAt: undefined }],
        loading: false,
        error: null,
        thresholdDays: 3,
      }),
    )
    expect(html).toMatchSnapshot()
  })

  it("shows loading state", () => {
    const html = renderToStaticMarkup(
      NoReplyListView({ items: [], loading: true, error: null, thresholdDays: 3 }),
    )
    expect(html.includes("กำลังโหลด")).toBe(true)
  })

  it("shows empty state", () => {
    const html = renderToStaticMarkup(
      NoReplyListView({ items: [], loading: false, error: null, thresholdDays: 3 }),
    )
    expect(html.includes("ไม่มีข้อมูล")).toBe(true)
  })

  it("shows error state", () => {
    const html = renderToStaticMarkup(
      NoReplyListView({ items: [], loading: false, error: "Error", thresholdDays: 3 }),
    )
    expect(html.includes("Error")).toBe(true)
  })
})
