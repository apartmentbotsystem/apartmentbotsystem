// Legacy tests type-only stub; not for runtime use
declare module "@/domain/entities/Room" {
  export class Room {
    constructor(id: string, number: string, status: string, maxOccupants: number)
    readonly id: string
    readonly number: string
    readonly status: string
    readonly maxOccupants: number
  }
}
