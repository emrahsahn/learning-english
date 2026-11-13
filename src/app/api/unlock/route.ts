import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, configuredPassword, matchesPassword, signAccess, TTL_SECONDS } from "@/lib/access";

// Best-effort instance throttle; production should also use Vercel Firewall rate limiting.
const attempts = new Map<string, { count: number; until: number }>();
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Geçersiz istek" }, { status: 403 });
  if (!configuredPassword()) return NextResponse.json({ error: "Site henüz yapılandırılmadı. SITE_PASSWORD ortam değişkenini ayarlayın." }, { status: 503 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const now = Date.now();
  const entry = attempts.get(ip);
  if (entry && entry.until > now && entry.count >= 8) return NextResponse.json({ error: "Çok fazla deneme. 15 dakika sonra tekrar deneyin." }, { status: 429 });
  if (attempts.size > 10000) attempts.clear();
  let password: unknown;
  try { password = (await request.json()).password; } catch { return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 }); }
  if (typeof password !== "string" || password.length > 512 || !matchesPassword(password)) {
    attempts.set(ip, { count: entry && entry.until > now ? entry.count + 1 : 1, until: entry && entry.until > now ? entry.until : now + 15 * 60000 });
    return NextResponse.json({ error: "Şifre doğru değil." }, { status: 401 });
  }
  attempts.delete(ip);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE, signAccess(now + TTL_SECONDS * 1000), {
    httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "strict", path: "/", maxAge: TTL_SECONDS,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
