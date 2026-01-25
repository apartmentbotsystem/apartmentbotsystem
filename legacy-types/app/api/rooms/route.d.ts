// Legacy tests type-only stub; not for runtime use
declare module "@/app/api/rooms/route" {
  export type RoomsGET = (req: Request) => Promise<Response>
  export const GET: RoomsGET
}
