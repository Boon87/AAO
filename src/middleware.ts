import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Free-tier Supabase auto-pauses after ~a week idle. This middleware asks Supabase
// "is this user logged in?" on EVERY route — so when it's asleep the call hangs,
// Vercel kills the middleware at ~25s, and the whole site returns a bare
// 504 MIDDLEWARE_INVOCATION_TIMEOUT. Cap the auth call and degrade gracefully
// into a page that explains what's happening instead of a scary white 504.
const AUTH_TIMEOUT_MS = 6000;
const TIMEOUT = "__timeout__";

type AuthProbe = { user: unknown | null; backendDown: boolean };

async function getUserSafe(supabase: ReturnType<typeof createServerClient>): Promise<AuthProbe> {
  const probe: Promise<AuthProbe> = (async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        // "Auth session missing" is the NORMAL logged-out case — not an outage.
        // Anything else (fetch/network failure) means Supabase is unreachable.
        const name = String(error.name || "");
        const msg = String(error.message || "").toLowerCase();
        const sessionMissing =
          name === "AuthSessionMissingError" || msg.includes("session missing") || msg.includes("auth session");
        if (!sessionMissing) return { user: null, backendDown: true };
      }
      return { user: data?.user ?? null, backendDown: false };
    } catch {
      return { user: null, backendDown: true }; // fetch threw → unreachable
    }
  })();

  const timer = new Promise<typeof TIMEOUT>((resolve) => setTimeout(() => resolve(TIMEOUT), AUTH_TIMEOUT_MS));
  const res = await Promise.race([probe, timer]);
  return res === TIMEOUT ? { user: null, backendDown: true } : res;
}

function backendStartingPage() {
  const html = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="15">
<title>后端启动中 · AAO</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
    font-family:"PingFang SC","Microsoft YaHei",system-ui,-apple-system,sans-serif;
    background:#f1f5f9;color:#1e293b}
  .card{max-width:460px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:18px;
    padding:32px;text-align:center;box-shadow:0 12px 32px -12px rgba(15,23,42,.15)}
  .spin{width:38px;height:38px;margin:0 auto 18px;border:3px solid #dbeafe;border-top-color:#2563eb;
    border-radius:50%;animation:r 1s linear infinite}
  @keyframes r{to{transform:rotate(360deg)}}
  @media (prefers-reduced-motion:reduce){.spin{animation:none}}
  h1{font-size:19px;font-weight:800;margin-bottom:10px}
  p{font-size:14px;line-height:1.7;color:#475569;margin-bottom:8px}
  b{color:#15803d}
  .muted{font-size:12px;color:#94a3b8;margin-top:14px}
  details{margin-top:16px;text-align:left;background:#f8fafc;border:1px solid #e2e8f0;
    border-radius:10px;padding:10px 12px}
  summary{font-size:12px;font-weight:700;color:#475569;cursor:pointer}
  details p{font-size:12px;margin:8px 0 0}
  code{background:#e2e8f0;padding:1px 5px;border-radius:4px;font-size:11px}
</style>
</head>
<body>
  <div class="card">
    <div class="spin"></div>
    <h1>后端正在启动中…</h1>
    <p>数据库（Supabase 免费版）闲置一段时间会自动休眠，正在唤醒。</p>
    <p><b>你的数据一条都没丢</b> —— 通常 1–2 分钟就会自动恢复。</p>
    <p class="muted">此页每 15 秒自动刷新，恢复后会自动进入系统。</p>
    <details>
      <summary>等了几分钟还是不行？</summary>
      <p>登录 <code>supabase.com</code> → 找项目 <code>floorpro-quotation</code>（名字奇怪，但这就是 AAO 的后端，别删）→ 点 <code>Restore / 恢复</code> → 等 1–2 分钟再刷新。</p>
    </details>
  </div>
</body>
</html>`;
  return new NextResponse(html, {
    status: 503,
    headers: { "content-type": "text/html; charset=utf-8", "retry-after": "15", "cache-control": "no-store" },
  });
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { user, backendDown } = await getUserSafe(supabase);

  // Supabase unreachable → explain it instead of hanging into a 504
  if (backendDown) return backendStartingPage();

  const { pathname } = request.nextUrl;

  // Unauthenticated → send to login
  if (!user && pathname !== "/login" && pathname !== "/signup") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Already logged in → skip login page
  if (user && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
