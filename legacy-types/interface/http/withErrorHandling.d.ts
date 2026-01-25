declare module "@/interface/http/withErrorHandling" {
  export function withErrorHandling<T extends (...args: any[]) => Promise<Response>>(handler: T): T
}
