// Legacy tests type-only stub; not for runtime use
declare module "@/app/api/admin/rooms/[id]/occupy/route" {
  export type RouteContext = { params: Promise<Record<string, string>> }
  export type OccupyPOST = (req: Request, context: RouteContext) => Promise<Response>
  export const POST: OccupyPOST
}
