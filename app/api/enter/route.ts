import { NextResponse, type NextRequest } from "next/server";
import { pickablePeople, resolveMe } from "@/lib/me";
import { familyPassword, roleForPassword } from "@/lib/auth";
import { q } from "@/lib/db";
import { PROM_PHOTO } from "@/lib/promPhoto";
import { cookieOptions, DEVICE_COOKIE, SESSION_COOKIE, signSession, verifySession } from "@/lib/session";

const LIMIT = 5;
const WINDOW = "15 minutes";

/**
 * Coming in: the family password first ({ password, check: true } returns the family list),
 * then "Who are you?" ({ password, personId }) signs this device in as that person. Only people who can sign in
 * (lib/signin) are offered or accepted; there's no way to add yourself.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { password?: string; check?: boolean; personId?: number };

  // Slow down guessing: five wrong passwords from one place in 15 minutes, then a wait.
  const key = (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
  const [recent] = await q<{ n: number }>(`select count(*)::int as n from login_attempts where key = $1 and at > now() - $2::interval`, [key, WINDOW]);
  if ((recent?.n ?? 0) >= LIMIT)
    return NextResponse.json({ error: "Too many tries. Wait 15 minutes and try again." }, { status: 429 });

  const role = await roleForPassword(body.password ?? "");
  if (!role) {
    await q(`insert into login_attempts (key) values ($1)`, [key]);
    await q(`delete from login_attempts where at < now() - interval '1 day'`);
    await new Promise((r) => setTimeout(r, 800));
    const left = LIMIT - (recent?.n ?? 0) - 1;
    return NextResponse.json({ error: left > 0 ? "That password didn't match. Ask a family member for the current one." : "Too many tries. Wait 15 minutes and try again." }, { status: left > 0 ? 401 : 429 });
  }
  await q(`delete from login_attempts where key = $1`, [key]);
  if (body.check) return NextResponse.json({ ok: true, people: await pickablePeople(), photo: PROM_PHOTO });

  // Keep the same device id across re-entries so people can still remove what they added.
  const existing = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const did = existing?.did ?? req.cookies.get(DEVICE_COOKIE)?.value ?? crypto.randomUUID();
  const me = await resolveMe(body);
  if ("error" in me) return NextResponse.json({ error: me.error }, { status: 400 });

  const res = NextResponse.json({ ok: true, name: me.name });
  res.cookies.set(SESSION_COOKIE, await signSession({ role, did, name: me.name, pid: me.id, v: (await familyPassword()).version }), { ...cookieOptions, maxAge: 60 * 60 * 24 * 365 });
  res.cookies.set(DEVICE_COOKIE, did, { ...cookieOptions, maxAge: 60 * 60 * 24 * 365 * 5 });
  return res;
}
