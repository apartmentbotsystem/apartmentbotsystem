import { AsyncLocalStorage } from 'async_hooks'

export type RequestContext = {
  route?: string
  userId?: string
}

const storage = new AsyncLocalStorage<RequestContext>()

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore()
}

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    storage.run(ctx, () => {
      Promise.resolve(fn()).then(resolve, reject)
    })
  })
}
