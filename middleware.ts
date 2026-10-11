import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/session";

const PUBLIC = ["/enter", "/api/enter", "/api/calendar/"];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (PUBLIC.some((p) => path.startsWith(p))) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Enter the family password first." }, { status: 401 });
    const url = new URL("/enter", req.url);
    if (path !== "/") url.searchParams.set("next", path + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  // One shuffle order per visit, so browse pages and Previous and Next on a photo stay in step.
  // A session cookie: it lasts until the browser is closed. The request gets it too, so this first page uses it.
  if (!req.cookies.get("df_shuffle") && !path.startsWith("/api/")) {
    const seed = Math.random().toString(36).slice(2, 10);
    const headers = new Headers(req.headers);
    headers.set("cookie", [req.headers.get("cookie"), `df_shuffle=${seed}`].filter(Boolean).join("; "));
    const res = NextResponse.next({ request: { headers } });
    res.cookies.set("df_shuffle", seed, { path: "/", sameSite: "lax" });
    return res;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
