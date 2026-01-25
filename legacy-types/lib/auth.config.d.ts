declare module "@/lib/auth.config" {
  export function verifySession(value: string | undefined): Promise<{ userId: string; role: string } | null>
  export function auth(req?: Request): Promise<{ userId: string; role: string } | null>
}
