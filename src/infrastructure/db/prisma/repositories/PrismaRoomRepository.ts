import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import type {
  RoomRepository,
  RoomFindFilter,
  CreateRoomInput,
  UpdateRoomPatch,
} from "@/domain/repositories/RoomRepository"
import { Room } from "@/domain/entities/Room"
type RoomRow = Awaited<ReturnType<typeof prisma.room.findMany>>[number]

export class PrismaRoomRepository implements RoomRepository {
  private toDomain(row: RoomRow): Room {
    return new Room(row.id, row.roomNumber, row.status, row.maxOccupants)
  }

  async findById(id: string): Promise<Room | null> {
    const row = await prisma.room.findUnique({ where: { id } })
    return row ? this.toDomain({ ...row }) : null
  }

  async findByNumber(number: string): Promise<Room | null> {
    const row = await prisma.room.findFirst({ where: { roomNumber: number } })
    return row ? this.toDomain({ ...row }) : null
  }

  async findAll(filter?: RoomFindFilter): Promise<Room[]> {
    const where: Record<string, unknown> = {}
    if (filter?.status) where.status = filter.status
    if (filter?.numberContains) where.roomNumber = { contains: filter.numberContains }
    const rows = await prisma.room.findMany({ where, orderBy: { roomNumber: "asc" }, take: 200 })
    return rows.map((r: RoomRow) => this.toDomain({ ...r }))
  }

  async create(input: CreateRoomInput): Promise<Room> {
    const row = await prisma.room.create({
      data: { roomNumber: input.number, status: input.status, maxOccupants: input.maxOccupants },
    })
    return this.toDomain({ ...row })
  }

  async update(id: string, patch: UpdateRoomPatch): Promise<Room> {
    const row = await prisma.room.update({
      where: { id },
      data: {
        roomNumber: patch.number,
        status: patch.status,
        maxOccupants: patch.maxOccupants,
      },
    })
    return this.toDomain({ ...row })
  }

  async delete(id: string): Promise<void> {
    await prisma.room.delete({ where: { id } })
  }

  async getRoomsOccupancyTimeline(
    roomId?: string,
  ): Promise<
    Array<{
      roomId: string
      tenantId: string | null
      startDate: Date
      endDate: Date | null
      status: "occupied" | "vacant"
    }>
  > {
    const rooms = await prisma.room.findMany({
      where: roomId ? { id: roomId } : undefined,
      select: { id: true },
      take: 500,
    })
    const out: Array<{
      roomId: string
      tenantId: string | null
      startDate: Date
      endDate: Date | null
      status: "occupied" | "vacant"
    }> = []
    for (const r of rooms) {
      const events = await prisma.occupancyEvent.findMany({
        where: { roomId: r.id },
        orderBy: { eventAt: "asc" },
        take: 5000,
      })
      const active = new Set<string>()
      let lastChange = new Date(0)
      let currentStatus: "occupied" | "vacant" = "vacant"
      for (const ev of events) {
        const prevStatus = currentStatus
        if (ev.type === "MOVE_IN" && ev.tenantId) active.add(ev.tenantId)
        else if (ev.type === "MOVE_OUT" && ev.tenantId) active.delete(ev.tenantId)
        currentStatus = active.size >= 1 ? "occupied" : "vacant"
        if (currentStatus !== prevStatus) {
          out.push({
            roomId: r.id,
            tenantId: Array.from(active.values())[0] ?? null,
            startDate: lastChange,
            endDate: ev.eventAt,
            status: prevStatus,
          })
          lastChange = ev.eventAt
        }
      }
      out.push({
        roomId: r.id,
        tenantId: Array.from(active.values())[0] ?? null,
        startDate: lastChange,
        endDate: null,
        status: currentStatus,
      })
    }
    return out
  }

  async getAdminMonthlyOccupancyDashboard(
    month: string,
  ): Promise<
    Array<{
      roomId: string
      totalOccupiedDays: number
      occupancyRate: number
      firstOccupiedAt: Date | null
      lastVacatedAt: Date | null
    }>
  > {
    const parts = String(month).split("-")
    if (parts.length !== 2) {
      return []
    }
    const year = Number(parts[0])
    const monthIndex = Number(parts[1])
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 1 || monthIndex > 12) {
      return []
    }
    const monthStart = new Date(Date.UTC(year, monthIndex - 1, 1))
    const monthEnd = new Date(Date.UTC(year, monthIndex, 0))
    const daysInMonth = Math.floor((monthEnd.getTime() - monthStart.getTime()) / (24 * 60 * 60 * 1000)) + 1

    const rooms = await prisma.room.findMany({ select: { id: true }, orderBy: { roomNumber: "asc" }, take: 1000 })
    type RoomIdRow = { id: string }
    const invoices = await prisma.invoice.findMany({
      where: { periodMonth: month },
      select: { roomId: true, issuedAt: true },
      take: 5000,
    })
    type InvoiceRow = { roomId: string; issuedAt: Date }
    const billedRooms = new Map<string, InvoiceRow[]>()
    invoices.forEach((inv: InvoiceRow) => {
      const list = billedRooms.get(inv.roomId) ?? []
      list.push(inv)
      billedRooms.set(inv.roomId, list)
    })
    const results = rooms.map(
      (r: RoomIdRow): {
        roomId: string
        totalOccupiedDays: number
        occupancyRate: number
        firstOccupiedAt: Date | null
        lastVacatedAt: Date | null
      } => {
        const hasInvoice = billedRooms.has(r.id)
        const totalOccupiedDays = hasInvoice ? daysInMonth : 0
        const occupancyRate = hasInvoice ? 100 : 0
        const firstOccupiedAt = hasInvoice ? monthStart : null
        const lastVacatedAt = null
        return { roomId: r.id, totalOccupiedDays, occupancyRate, firstOccupiedAt, lastVacatedAt }
      },
    )
    return results
  }
}
