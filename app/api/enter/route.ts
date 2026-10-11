import { NextResponse, type NextRequest } from "next/server";
import { pickablePeople, resolveMe } from "@/lib/me";
import { checkPassword } from "@/lib/password";
import { cookieOptions, DEVICE_COOKIE, SESSION_COOKIE, signSession, verifySession, type Role } from "@/lib/session";

/**
 * Coming in: the family password first ({ password, check: true } returns the family list),
 * then "Which one is you?" ({ password, personId } or { password, newName }) signs this device in as that person.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { password?: string; check?: boolean; personId?: number; newName?: string };

  let role: Role | null = null;
  if (checkPassword(body.password ?? "", process.env.ADMIN_PASSWORD_HASH)) role = "admin";
  else if (checkPassword(body.password ?? "", process.env.FAMILY_PASSWORD_HASH)) role = "family";
  if (!role) {
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "That password didn't match. Ask a family member for the current one." }, { status: 401 });
  }
  if (body.check) return NextResponse.json({ ok: true, people: await pickablePeople() });

  // Keep the same device id across re-entries so people can still remove what they added.
  const existing = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const did = existing?.did ?? req.cookies.get(DEVICE_COOKIE)?.value ?? crypto.randomUUID();
  const me = await resolveMe(body, did);
  if ("error" in me) return NextResponse.json({ error: me.error }, { status: 400 });

  const res = NextResponse.json({ ok: true, name: me.name });
  res.cookies.set(SESSION_COOKIE, await signSession({ role, did, name: me.name, pid: me.id }), { ...cookieOptions, maxAge: 60 * 60 * 24 * 365 });
  res.cookies.set(DEVICE_COOKIE, did, { ...cookieOptions, maxAge: 60 * 60 * 24 * 365 * 5 });
  return res;
}
