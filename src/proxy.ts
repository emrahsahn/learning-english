import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, configuredPassword, validAccess } from "@/lib/access";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // Static framework assets contain UI only. Oxford data is never bundled.
  if (path.startsWith("/_next/") || path === "/favicon.ico" || path === "/unlock" || path === "/api/unlock" || path === "/api/lock") return NextResponse.next();
  if (!configuredPassword() && process.env.NODE_ENV !== "production") return NextResponse.next();
  if (validAccess(request.cookies.get(ACCESS_COOKIE)?.value)) {
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }
  if (path.startsWith("/api/") || path.startsWith("/data/")) return NextResponse.json({ error: "Erişim kilitli" }, { status: 401 });
  return NextResponse.redirect(new URL("/unlock", request.url));
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
