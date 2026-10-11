import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/** Log out this device. The device id stays, so coming back in still lets people remove what they added. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}

/** After the family password changes, older family sessions land here: clear the cookie and say why. */
export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/enter?changed=1", req.url));
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
