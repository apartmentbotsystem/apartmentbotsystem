export class Room {
  constructor(
    public readonly id: string,
    public readonly number: string,
    public readonly status: string,
    public readonly maxOccupants: number
  ) {}
}

