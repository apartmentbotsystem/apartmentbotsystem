import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk, respondError } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"

export const runtime = "nodejs"

function isValidMonth(s: string): boolean {
  return /^\d{4}-\d{2}$/.test(s)
}
function startOfMonthUTC(month: string): Date {
  const [y, m] = month.split("-").map((x) => Number(x))
  return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0))
}
function endOfMonthUTC(month: string): Date {
  const [y, m] = month.split("-").map((x) => Number(x))
  const d = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0))
  d.setUTCMilliseconds(-1)
  return d
}
function fmtDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const url = new URL(req.url)
  const monthParam = url.searchParams.get("month")
  let month: string
  if (monthParam && !isValidMonth(monthParam)) {
    return respondError(req, "VALIDATION_ERROR", "Invalid month format (expected YYYY-MM)", 400)
  }
  if (monthParam) {
    month = monthParam
  } else {
    const now = new Date()
    const y = now.getUTCFullYear()
    const m = String(now.getUTCMonth() + 1).padStart(2, "0")
    month = `${y}-${m}`
  }
  const start = startOfMonthUTC(month)
  const end = endOfMonthUTC(month)

  const rooms = await prisma.room.findMany({
    orderBy: { roomNumber: "asc" },
    select: { id: true, status: true },
    take: 2000,
  })
  const totalRooms = rooms.length
  const occupiedRooms = rooms.filter((r) => String(r.status) === "OCCUPIED").length
  const vacantRooms = rooms.filter((r) => String(r.status) === "AVAILABLE").length
  const occupancyRate = totalRooms > 0 ? round2((occupiedRooms / totalRooms) * 100) : 0

  const events = await prisma.occupancyEvent.findMany({
    where: { eventAt: { gte: start, lte: end } },
    orderBy: { eventAt: "asc" },
    take: 5000,
  })
  type Ev = Awaited<ReturnType<typeof prisma.occupancyEvent.findMany>>[number]
  const moveInCount = events.filter((e: Ev) => String(e.type) === "MOVE_IN").length
  const moveOutCount = events.filter((e: Ev) => String(e.type) === "MOVE_OUT").length

  const days: string[] = []
  {
    const cur = new Date(start)
    while (cur <= end) {
      days.push(fmtDate(cur))
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
  }
  const moveInDaily = days.map((d) => ({
    date: d,
    count: events.filter((e: Ev) => fmtDate(e.eventAt) === d && String(e.type) === "MOVE_IN").length,
  }))
  const moveOutDaily = days.map((d) => ({
    date: d,
    count: events.filter((e: Ev) => fmtDate(e.eventAt) === d && String(e.type) === "MOVE_OUT").length,
  }))

  const payload = {
    periodMonth: month,
    kpis: { totalRooms, occupiedRooms, vacantRooms, occupancyRate },
    monthly: { moveInCount, moveOutCount },
    trends: { moveInDaily, moveOutDaily },
  }
  return respondOk(req, payload, 200)
})

