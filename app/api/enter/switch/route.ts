import { NextResponse, type NextRequest } from "next/server";
import { getSession, unauthorized } from "@/lib/auth";
import { resolveMe } from "@/lib/me";
import { cookieOptions, SESSION_COOKIE, signSession } from "@/lib/session";

/** "Not Mary? Switch person": same device, same password, a different person. */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return unauthorized();
  const me = await resolveMe((await req.json()) as { personId?: number; newName?: string }, s.did);
  if ("error" in me) return NextResponse.json({ error: me.error }, { status: 400 });
  const res = NextResponse.json({ ok: true, name: me.name });
  res.cookies.set(SESSION_COOKIE, await signSession({ ...s, name: me.name, pid: me.id }), { ...cookieOptions, maxAge: 60 * 60 * 24 * 365 });
  return res;
}
