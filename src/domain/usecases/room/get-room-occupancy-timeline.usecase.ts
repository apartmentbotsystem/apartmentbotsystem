import type { RoomTimelineReader, RoomOccupancyTimelineItem } from "@/domain/interfaces/room-timeline-reader"

export type GetRoomOccupancyTimelineInput = {
  roomId: string
  month: string
}

export class GetRoomOccupancyTimelineUseCase {
  constructor(private readonly reader: RoomTimelineReader) {}

  async execute(input: GetRoomOccupancyTimelineInput): Promise<RoomOccupancyTimelineItem[]> {
    return this.reader.getRoomTimeline(input.roomId, input.month)
  }
}
