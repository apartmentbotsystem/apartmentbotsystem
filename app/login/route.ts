import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createSession, setSessionCookie } from '@/lib/auth/session'
import { ensureCsrfCookie } from '@/lib/http/csrf'
import { verifyPassword } from '@/lib/auth/password'
import { logger } from '@/lib/logging/file-logger'

function safeNextPath(input: string | null | undefined): string {
  const v = String(input ?? '').trim()
  if (!v.startsWith('/')) return '/dashboard'
  if (v.startsWith('//')) return '/dashboard'
  return v
}

function renderLoginHtml(hasError: boolean, nextPath: string): string {
  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>เข้าสู่ระบบ</title>
  <style>
    :root {
      --bg0: #f6f8fc;
      --bg1: #eaf0ff;
      --card: #ffffff;
      --text: #101828;
      --muted: #475467;
      --line: #d0d9ea;
      --primary: #0f5cc0;
      --primary-2: #0a3f85;
      --danger-bg: #fff1f2;
      --danger-text: #b42318;
      --shadow: 0 20px 50px rgba(7, 34, 77, 0.16);
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      font-family: "Segoe UI", "Noto Sans Thai", Tahoma, sans-serif;
      color: var(--text);
      background:
        radial-gradient(1200px 600px at -10% -10%, #c9dcff 0%, transparent 55%),
        radial-gradient(1000px 560px at 110% 110%, #dce8ff 0%, transparent 52%),
        linear-gradient(180deg, var(--bg1), var(--bg0));
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .panel {
      width: min(460px, 100%);
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 22px;
      box-shadow: var(--shadow);
      padding: 28px 24px 22px;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
      color: #0b3b78;
      font-size: 13px;
      letter-spacing: .02em;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    h1 {
      margin: 0;
      font-size: 32px;
      line-height: 1.15;
    }
    .sub {
      margin: 10px 0 20px;
      color: var(--muted);
      font-size: 15px;
    }
    .group { display: grid; gap: 8px; }
    label { font-size: 13px; color: var(--muted); font-weight: 600; }
    input {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 11px 12px;
      font-size: 15px;
      outline: none;
      transition: .15s ease;
      background: #fff;
    }
    input:focus {
      border-color: #78a6e9;
      box-shadow: 0 0 0 4px rgba(15, 92, 192, 0.16);
    }
    .actions { margin-top: 14px; }
    button {
      width: 100%;
      border: none;
      border-radius: 12px;
      padding: 12px 14px;
      background: linear-gradient(180deg, var(--primary), var(--primary-2));
      color: #fff;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      transition: transform .06s ease, filter .16s ease;
    }
    button:hover { filter: brightness(1.06); }
    button:active { transform: translateY(1px); }
    .error {
      margin: 12px 0 0;
      border: 1px solid #fecdd3;
      background: var(--danger-bg);
      color: var(--danger-text);
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 13px;
      font-weight: 600;
    }
    .foot {
      margin-top: 16px;
      font-size: 12px;
      color: #667085;
      text-align: center;
    }
  </style>
</head>
<body>
  <main class="panel">
    <div class="brand">Apartment ERP</div>
    <h1>เข้าสู่ระบบ</h1>
    <p class="sub">กรุณาเข้าสู่ระบบเพื่อเข้าถึงระบบจัดการอพาร์ตเมนต์</p>
    <form method="post" action="/login" class="group">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" value="admin@apartment.local" autocomplete="username" required />
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required />
      <input type="hidden" name="next" value="${nextPath.replace(/"/g, '&quot;')}" />
      <div class="actions">
        <button type="submit">เข้าสู่ระบบ</button>
      </div>
    </form>
    ${hasError ? '<p class="error">ข้อมูลเข้าสู่ระบบไม่ถูกต้อง</p>' : ''}
    <div class="foot">Secure Access • Apartment ERP</div>
  </main>
</body>
</html>`
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const hasError = url.searchParams.get('error') === '1'
  const nextPath = safeNextPath(url.searchParams.get('next'))
  return new NextResponse(renderLoginHtml(hasError, nextPath), {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
  })
}

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const email = String(form.get('email') ?? '').trim().toLowerCase()
    const password = String(form.get('password') ?? '')
    const nextPath = safeNextPath(String(form.get('next') ?? ''))

    if (!email || !password) {
      return NextResponse.redirect(new URL(`/login?error=1&next=${encodeURIComponent(nextPath)}`, req.url))
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        passwordHash: true,
        sessionVersion: true,
        userRoles: { include: { role: { select: { code: true } } } }
      }
    })

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.redirect(new URL(`/login?error=1&next=${encodeURIComponent(nextPath)}`, req.url))
    }

    const roleCodes = user.userRoles.map((ur) => ur.role.code)
    const role = roleCodes.includes('OWNER') || roleCodes.includes('SUPER_ADMIN')
      ? 'OWNER'
      : roleCodes.includes('ADMIN') || roleCodes.includes('MANAGER') || roleCodes.includes('FINANCE') || roleCodes.includes('ACCOUNTANT')
        ? 'ADMIN'
        : 'STAFF'

    const token = await createSession(user.id, role, user.sessionVersion ?? 0)
    await setSessionCookie(token)
    await ensureCsrfCookie()

    return NextResponse.redirect(new URL(nextPath, req.url))
  } catch (err) {
    const url = new URL(req.url)
    const nextPath = safeNextPath(url.searchParams.get('next'))
    const message = err instanceof Error ? err.message : String(err)
    await logger.error('LOGIN_FAILED', { message })
    return NextResponse.redirect(new URL(`/login?error=1&next=${encodeURIComponent(nextPath)}`, req.url))
  }
}
