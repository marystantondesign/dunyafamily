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
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
