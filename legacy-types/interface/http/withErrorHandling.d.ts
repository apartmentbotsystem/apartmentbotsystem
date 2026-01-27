declare module "@/interface/http/withErrorHandling" {
  export function withErrorHandling<C extends object | undefined = object>(
    handler: (req: Request, ctx: C) => Promise<Response>,
  ): (req: Request, ctx?: C) => Promise<Response>
}
