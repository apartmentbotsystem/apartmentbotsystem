export default function LoginPage() {
  return (
    <div className="max-w-sm mx-auto border rounded p-6 bg-white">
      <h1 className="text-lg font-semibold mb-4">Login</h1>
      <form action="/dashboard" method="get" className="space-y-3">
        <input type="email" name="email" className="w-full border rounded px-2 py-1" placeholder="Email" />
        <input type="password" name="password" className="w-full border rounded px-2 py-1" placeholder="Password" />
        <button className="w-full rounded bg-slate-800 px-3 py-2 text-white">Login</button>
      </form>
    </div>
  )
}
