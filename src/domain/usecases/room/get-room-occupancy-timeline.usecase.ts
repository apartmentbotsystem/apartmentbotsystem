import type { RoomTimelineReader, RoomOccupancyTimelineItem } from "@/domain/interfaces/room-timeline-reader"

export type GetRoomOccupancyTimelineInput = {
  roomId: string
  from: Date
  to: Date
}

export class GetRoomOccupancyTimelineUseCase {
  constructor(private readonly reader: RoomTimelineReader) {}

  async execute(input: GetRoomOccupancyTimelineInput): Promise<RoomOccupancyTimelineItem[]> {
    return this.reader.getTimeline(input.roomId, { from: input.from, to: input.to })
  }
}
