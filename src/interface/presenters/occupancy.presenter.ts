import type { OccupancyDTO } from "@/application/dto/occupancy.dto"
import { RoomOccupancy } from "@/domain/entities/RoomOccupancy"

export function presentOccupancyDTO(o: RoomOccupancy): OccupancyDTO {
  return {
    id: o.id,
    startedAt: o.startedAt.toISOString(),
    endedAt: o.endedAt ? o.endedAt.toISOString() : null,
  }
}
