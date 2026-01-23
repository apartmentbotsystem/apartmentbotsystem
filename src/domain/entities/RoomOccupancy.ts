export class RoomOccupancy {
  constructor(
    public readonly id: string,
    public readonly roomId: string,
    public readonly startedAt: Date,
    public readonly endedAt: Date | null
  ) {}
}
