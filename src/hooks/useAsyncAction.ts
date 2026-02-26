import { useCallback, useState } from 'react'

export default function useAsyncAction<T>(fn: () => Promise<T>) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const execute = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fn()
      setLoading(false)
      return res
    } catch (e) {
      setLoading(false)
      setError(e)
      throw e
    }
  }, [fn])
  const run = execute
  return { run, execute, loading, error }
}
