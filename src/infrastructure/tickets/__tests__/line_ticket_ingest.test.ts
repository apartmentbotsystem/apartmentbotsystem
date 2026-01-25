import { describe, it, expect, vi, beforeEach } from "vitest"
import { ingestLineMessage } from "@/infrastructure/tickets/lineTicketIngest.service"

let store: Array<{ id: string; externalThreadId: string; status: "OPEN" | "CLOSED"; title: string; createdAt: Date }> = []

vi.mock("@/infrastructure/db/prisma/prismaClient", () => {
  const ticket = {
    findFirst: vi.fn(async (args: { where: { externalThreadId?: string; status?: string } }) => {
      const w = args.where || {}
      return (
        store.find((t) => (!w.externalThreadId || t.externalThreadId === w.externalThreadId) && (!w.status || t.status === (w.status as "OPEN" | "CLOSED"))) ??
        null
      )
    }),
    create: vi.fn(async ({ data }: { data: { source: string; externalThreadId: string; title: string; status: "OPEN" } }) => {
      const id = `t${store.length + 1}`
      const row = { id, externalThreadId: data.externalThreadId, status: data.status, title: data.title, createdAt: new Date() }
      store.push(row)
      return { id: row.id, source: data.source, externalThreadId: row.externalThreadId, title: row.title, status: row.status, createdAt: row.createdAt }
    }),
  }
  return { prisma: { ticket } }
})

vi.mock("@/infrastructure/db/domainTransaction", () => ({
  domainTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
}))

vi.mock("@/infrastructure/audit/audit.service", () => ({
  emitAuditEvent: vi.fn(async () => undefined),
}))

describe("lineTicketIngest", () => {
  beforeEach(() => {
    store = []
  })

  it("reuses existing OPEN ticket for same thread", async () => {
    store.push({ id: "t1", externalThreadId: "user-1", status: "OPEN", title: "Hi", createdAt: new Date() })
    const id = await ingestLineMessage({ source: { userId: "user-1" }, message: { text: "Hello again" } })
    expect(id).toBe("t1")
  })

  it("creates new ticket if previous is CLOSED", async () => {
    store.push({ id: "t1", externalThreadId: "user-1", status: "CLOSED", title: "Done", createdAt: new Date() })
    const id = await ingestLineMessage({ source: { userId: "user-1" }, message: { text: "New issue" } })
    expect(id).toBe("t2")
  })
})
