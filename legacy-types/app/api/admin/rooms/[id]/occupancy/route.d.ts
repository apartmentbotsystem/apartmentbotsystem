// Legacy tests type-only stub; not for runtime use
declare module "@/app/api/admin/rooms/[id]/occupancy/route" {
  export type RouteContext = { params: Promise<Record<string, string>> }
  export type OccupancyGET = (req: Request, context: RouteContext) => Promise<Response>
  export const GET: OccupancyGET
}
