'use client'

import { useState } from "react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchEnvelope(url: string, init?: RequestInit) {
    const res = await fetch(url, {
      ...init,
      headers: { ...(init?.headers || {}), accept: "application/vnd.apartment.v1.1+json" },
    })
    const json = await res.json()
    if (json.success) return json.data
    throw new Error(json.error?.message || "Error")
  }

  async function submit() {
    setLoading(true)
    setError(null)
    try {
      await fetchEnvelope("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      window.location.href = "/dashboard"
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto border rounded p-6 bg-white">
      <h1 className="text-lg font-semibold mb-4">Login</h1>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded px-2 py-1"
          placeholder="Email"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded px-2 py-1"
          placeholder="Password"
        />
        <button disabled={loading} className="w-full rounded bg-slate-800 px-3 py-2 text-white disabled:opacity-50">
          Login
        </button>
      </form>
      {error && <div className="text-red-600 mt-3">Error: {error}</div>}
    </div>
  )
}
