declare module "@/lib/guards" {
  export function requireRole(req: Request, roles: string[]): Promise<{ userId: string; role: string }>
}
