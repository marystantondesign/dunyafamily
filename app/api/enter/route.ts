import { NextResponse, type NextRequest } from "next/server";
import { checkPassword } from "@/lib/password";
import { DEVICE_COOKIE, SESSION_COOKIE, signSession, verifySession, type Role } from "@/lib/session";

export async function POST(req: NextRequest) {
  const { password, name } = (await req.json()) as { password?: string; name?: string };
  const displayName = (name ?? "").trim().slice(0, 60);
  if (!displayName) return NextResponse.json({ error: "Add your name so the family knows who shared what." }, { status: 400 });

  let role: Role | null = null;
  if (checkPassword(password ?? "", process.env.ADMIN_PASSWORD_HASH)) role = "admin";
  else if (checkPassword(password ?? "", process.env.FAMILY_PASSWORD_HASH)) role = "family";
  if (!role) {
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "That password didn't match. Ask a family member for the current one." }, { status: 401 });
  }

  // Keep the same device id across re-entries so people can still remove what they added.
  const existing = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const did = existing?.did ?? req.cookies.get(DEVICE_COOKIE)?.value ?? crypto.randomUUID();

  const res = NextResponse.json({ ok: true });
  const opts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
  res.cookies.set(SESSION_COOKIE, await signSession({ role, did, name: displayName }), { ...opts, maxAge: 60 * 60 * 24 * 365 });
  res.cookies.set(DEVICE_COOKIE, did, { ...opts, maxAge: 60 * 60 * 24 * 365 * 5 });
  return res;
}
