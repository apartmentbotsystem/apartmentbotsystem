import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import type {
  RoomRepository,
  RoomFindFilter,
  CreateRoomInput,
  UpdateRoomPatch,
} from "@/domain/repositories/RoomRepository"
import { Room } from "@/domain/entities/Room"
import { sortRooms } from "@/core/project-rules/room-sorter"
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
    const where: Record<string, unknown> = {}
    if (roomId) where["roomId"] = roomId
    const rows = await prisma.roomOccupancy.findMany({
      where,
      include: { room: { select: { id: true, roomNumber: true } } },
      orderBy: { startedAt: "asc" },
      take: 5000,
    })
    type Row = (typeof rows)[number]
    const byRoom: Map<
      string,
      { roomId: string; roomNumber: string; intervals: Array<{ start: Date; end: Date | null }> }
    > = new Map()
    for (const r of rows as Array<Row>) {
      const rid = r.room.id
      const rn = r.room.roomNumber
      const start = r.startedAt
      const end = r.endedAt ?? null
      const cur = byRoom.get(rid) ?? { roomId: rid, roomNumber: rn, intervals: [] }
      cur.intervals.push({ start, end })
      byRoom.set(rid, cur)
    }
    const result: Array<{
      roomId: string
      tenantId: string | null
      startDate: Date
      endDate: Date | null
      status: "occupied" | "vacant"
    }> = []
    const sortedRoomNumbers = sortRooms(Array.from(byRoom.values()).map((x) => x.roomNumber))
    const byNumber: Map<string, { roomId: string; roomNumber: string; intervals: Array<{ start: Date; end: Date | null }> }> =
      new Map(Array.from(byRoom.values()).map((e) => [e.roomNumber, e]))
    for (const rn of sortedRoomNumbers) {
      const entry = byNumber.get(rn)
      if (!entry) continue
      const intervals = entry.intervals.slice()
      const merged: Array<{ start: Date; end: Date | null }> = []
      for (const iv of intervals) {
        const last = merged[merged.length - 1]
        if (!last) {
          merged.push({ start: iv.start, end: iv.end })
        } else {
          const lastEndTs = last.end ? last.end.getTime() : Number.POSITIVE_INFINITY
          if (iv.start.getTime() <= lastEndTs) {
            if (!last.end || (iv.end && iv.end.getTime() > last.end.getTime())) {
              last.end = iv.end ?? null
            }
          } else {
            merged.push({ start: iv.start, end: iv.end })
          }
        }
      }
      for (let i = 0; i < merged.length; i += 1) {
        const occ = merged[i]
        result.push({
          roomId: entry.roomId,
          tenantId: null,
          startDate: occ.start,
          endDate: occ.end ?? null,
          status: "occupied",
        })
        const next = merged[i + 1]
        if (occ.end && next && next.start.getTime() > occ.end.getTime()) {
          result.push({
            roomId: entry.roomId,
            tenantId: null,
            startDate: occ.end,
            endDate: next.start,
            status: "vacant",
          })
        }
      }
    }
    return result
  }
}
