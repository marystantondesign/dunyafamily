import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/** Log out this device. The device id stays, so coming back in still lets people remove what they added. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
