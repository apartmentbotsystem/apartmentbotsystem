// Legacy tests type-only stub; not for runtime use
declare module "@/app/api/admin/rooms/[id]/vacate/route" {
  export type RouteContext = { params: Promise<Record<string, string>> }
  export type VacatePOST = (req: Request, context: RouteContext) => Promise<Response>
  export const POST: VacatePOST
}
